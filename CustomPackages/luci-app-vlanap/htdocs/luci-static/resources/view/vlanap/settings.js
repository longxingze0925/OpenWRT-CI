'use strict';
'require view';
'require form';
'require fs';
'require ui';
'require uci';
'require dom';

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('vlanap').catch(function() {}),
			fs.exec('/usr/sbin/vlanap', [ 'status' ]).catch(function(err) {
				return { stdout: '', stderr: err.message || String(err) };
			})
		]).then(function(data) {
			return data[1];
		}).catch(function(err) {
			return { stdout: '', stderr: err.message || String(err) };
		});
	},

	runVlanap: function(args, successMessage) {
		return fs.exec('/usr/sbin/vlanap', args).then(function(res) {
			var output = [ res.stdout, res.stderr ].filter(Boolean).join('\n');
			ui.addNotification(null, E('p', {}, successMessage || output || _('操作已完成')), 'info');
			return output;
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
		});
	},

	handleApplySafe: function() {
		return this.runVlanap([ 'apply-safe' ], _('已安全应用。请在 180 秒内重新连上管理地址并确认应用。'));
	},

	handleConfirm: function() {
		return this.runVlanap([ 'confirm' ], _('已确认应用，不会自动回滚。'));
	},

	getFieldValue: function(id, fallback) {
		var field = document.querySelector('#' + id);
		var value = field ? field.value : '';

		return value || fallback || '';
	},

	renderBatchValue: function(label, id, fieldNodes, description) {
		var labelAttrs = { 'class': 'cbi-value-title' };
		var nodes = Array.isArray(fieldNodes) ? fieldNodes.slice() : [ fieldNodes ];

		if (id)
			labelAttrs['for'] = id;

		if (description)
			nodes.push(E('div', { 'class': 'cbi-value-description' }, description));

		return E('div', { 'class': 'cbi-value' }, [
			E('label', labelAttrs, label),
			E('div', { 'class': 'cbi-value-field' }, nodes)
		]);
	},

	renderBatchSection: function(title, rows) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, title)
		].concat(rows));
	},

	getConfigValue: function(option, fallback) {
		return uci.get('vlanap', 'main', option) || fallback || '';
	},

	getIPv4Part: function(value, index, fallback) {
		var parts = String(value || '').split('.');

		if (parts.length === 4 && parts[index])
			return parts[index];

		return fallback || '';
	},

	getBatchNetworkDefaults: function() {
		var manageIp = this.getConfigValue('manage_ip', '172.16.254.254');
		var gateway = this.getConfigValue('gateway', '172.16.254.1');

		return {
			manageVlan: this.getConfigValue('manage_vlan', '254'),
			managePort: 'lan2',
			ipPrefix: this.getIPv4Part(manageIp, 0, '172') + '.' + this.getIPv4Part(manageIp, 1, '16'),
			gatewayHost: this.getIPv4Part(gateway, 3, '1'),
			manageHost: this.getIPv4Part(manageIp, 3, '254')
		};
	},

	getNextWifiNumber: function(statusText) {
		var match = String(statusText || '').match(/next Wi-Fi number:\s*([0-9]+)/);
		var manageNetwork, stored, sections, max, i, section, seq, name, candidates, j, parsed;

		if (match)
			return parseInt(match[1], 10) || 1;

		manageNetwork = uci.get('vlanap', 'main', 'manage_network') || '';
		stored = parseInt(uci.get('vlanap', 'main', 'next_sequence'), 10) || 0;
		sections = uci.sections('vlanap', 'wifi') || [];
		max = 0;

		for (i = 0; i < sections.length; i++) {
			section = sections[i];

			if (manageNetwork && section.network === manageNetwork)
				continue;

			seq = parseInt(section.sequence, 10) || 0;
			name = section['.name'] || section.name || '';
			candidates = [
				seq,
				String(name).match(/(?:^|_)vlan([0-9]+)(?:_|$)/),
				String(section.network || '').match(/([0-9]+)$/),
				String(section.ssid || '').match(/([0-9]+)$/)
			];

			for (j = 0; j < candidates.length; j++) {
				if (Array.isArray(candidates[j]))
					parsed = parseInt(candidates[j][1], 10) || 0;
				else
					parsed = parseInt(candidates[j], 10) || 0;

				if (parsed > max && parsed < 254)
					max = parsed;
			}
		}

		return Math.max(stored, max + 1, 1);
	},

	getBatchPreviewData: function() {
		var defaultStart = this._batchPreviewStart ? String(this._batchPreviewStart) : '1';
		var start = parseInt(this.getFieldValue('vlanap_batch_preview_start', defaultStart), 10) || 1;
		var count = parseInt(this.getFieldValue('vlanap_batch_count', '5'), 10) || 5;
		var step = parseInt(this.getFieldValue('vlanap_batch_step', '1'), 10) || 1;
		var prefix = this.getFieldValue('vlanap_batch_ssid_prefix', 'WiFi');
		var networkPrefix = this.getFieldValue('vlanap_batch_network_prefix', 'vlan');
		var key = this.getFieldValue('vlanap_batch_key');
		var macMode = this.getFieldValue('vlanap_batch_mac_mode', 'auto');
		var macText = _('自动');
		var rows = [];
		var i, seq;

		count = Math.max(1, Math.min(count, 32));
		step = Math.max(1, step);

		if (macMode === 'random')
			macText = _('随机生成');
		else if (macMode === 'ap')
			macText = _('按 AP 规则生成');
		else if (macMode === 'vendor')
			macText = _('按厂家号生成');

		for (i = 0; i < count; i++) {
			seq = start + i * step;
			rows.push({
				sequence: seq,
				name: networkPrefix + seq + '_wifi',
				network: networkPrefix + seq,
				ssid: prefix + seq,
				encryption: 'WPA2-PSK',
				key: key ? _('统一密码') : _('待填写'),
				macaddr: macText,
				isolate: _('否'),
				hidden: _('否')
			});
		}

		return rows;
	},

	renderBatchPreviewRows: function() {
		var rows = this.getBatchPreviewData();
		var nodes = [];
		var cellStyle = 'padding:3px 10px; text-align:left; white-space:nowrap; vertical-align:top';
		var i;

		for (i = 0; i < rows.length; i++) {
			nodes.push(E('tr', {}, [
				E('td', { 'style': cellStyle }, rows[i].name),
				E('td', { 'style': cellStyle }, rows[i].network),
				E('td', { 'style': cellStyle }, rows[i].ssid),
				E('td', { 'style': cellStyle }, rows[i].encryption),
				E('td', { 'style': cellStyle }, rows[i].key),
				E('td', { 'style': cellStyle }, rows[i].macaddr),
				E('td', { 'style': cellStyle }, rows[i].isolate),
				E('td', { 'style': cellStyle }, rows[i].hidden)
			]));
		}

		return nodes;
	},

	updateBatchPreview: function() {
		var tbody = document.querySelector('#vlanap_batch_preview tbody');

		if (!tbody)
			return;

		while (tbody.firstChild)
			tbody.removeChild(tbody.firstChild);

		this.renderBatchPreviewRows().forEach(function(row) {
			tbody.appendChild(row);
		});
	},

	bindBatchPreview: function() {
		var self = this;
		var ids = [
			'vlanap_batch_count',
			'vlanap_batch_ssid_prefix',
			'vlanap_batch_key',
			'vlanap_batch_network_prefix',
			'vlanap_batch_step',
			'vlanap_batch_mac_mode'
		];

		ids.forEach(function(id) {
			var field = document.querySelector('#' + id);

			if (field) {
				field.addEventListener('input', self.updateBatchPreview.bind(self));
				field.addEventListener('change', self.updateBatchPreview.bind(self));
			}
		});
	},

	handleBatchGenerate: function() {
		var key = this.getFieldValue('vlanap_batch_key');
		var keepExisting = document.querySelector('#vlanap_batch_append');
		var mode = (!keepExisting || keepExisting.checked) ? 'append' : 'replace';
		var macMode = this.getFieldValue('vlanap_batch_mac_mode', 'auto');
		var networkDefaults = this.getBatchNetworkDefaults();
		var args = [
			'batch-generate',
			'auto',
			this.getFieldValue('vlanap_batch_count', '5'),
			this.getFieldValue('vlanap_batch_step', '1'),
			this.getFieldValue('vlanap_batch_network_prefix', 'vlan'),
			this.getFieldValue('vlanap_batch_ssid_prefix', 'WiFi'),
			key,
			this.getFieldValue('vlanap_batch_uplink', 'lan1'),
			this.getFieldValue('vlanap_batch_access_ports', ''),
			macMode,
			mode,
			networkDefaults.manageVlan,
			networkDefaults.managePort,
			networkDefaults.ipPrefix,
			networkDefaults.gatewayHost,
			networkDefaults.manageHost
		];

		if (!key || key.length < 8) {
			ui.addNotification(null, E('p', {}, _('Wi-Fi 密码至少需要 8 位。')), 'danger');
			return Promise.resolve();
		}

		ui.hideModal();

		return this.runVlanap(args, _('已批量创建 Wi-Fi 配置，请检查后点击“安全应用”。')).then(function() {
			window.setTimeout(function() { window.location.reload(); }, 800);
		});
	},

	getSelectedWifiSections: function() {
		var checked = document.querySelectorAll('.vlanap-wifi-select-row:checked');
		var sections = [];
		var i;

		for (i = 0; i < checked.length; i++)
			sections.push(checked[i].getAttribute('data-section'));

		return sections;
	},

	handleSelectAllWifi: function(ev) {
		var rows = document.querySelectorAll('.vlanap-wifi-select-row');
		var i;

		for (i = 0; i < rows.length; i++)
			rows[i].checked = ev.target.checked;
	},

	handleGenerateSelectedMac: function() {
		var sections = this.getSelectedWifiSections();
		var task = Promise.resolve();
		var i;

		if (!sections.length) {
			ui.addNotification(null, E('p', {}, _('请先选择要切换 MAC 的 Wi-Fi。')), 'warning');
			return Promise.resolve();
		}

		for (i = 0; i < sections.length; i++) {
			task = task.then(L.bind(function(section) {
				return fs.exec('/usr/sbin/vlanap', [ 'mac-generate', section, 'random' ]);
			}, this, sections[i]));
		}

		return task.then(function() {
			ui.addNotification(null, E('p', {}, _('已为选中的 Wi-Fi 生成新的 MAC，请检查后点击“安全应用”。')), 'info');
			window.setTimeout(function() { window.location.reload(); }, 800);
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
		});
	},

	showBatchCreateModal: function(statusText) {
		var nextNumber = this.getNextWifiNumber(statusText);
		var modal;
		this._batchPreviewStart = nextNumber;
		var body = E('div', { 'class': 'cbi-map', 'style': 'width:100%; max-width:1000px' }, [
			E('input', {
				'id': 'vlanap_batch_preview_start',
				'type': 'hidden',
				'value': String(nextNumber)
			}),
			this.renderBatchSection(_('创建 Wi-Fi'), [
				this.renderBatchValue(_('创建数量'), 'vlanap_batch_count',
					E('input', { 'id': 'vlanap_batch_count', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '32', 'value': '5' }),
					_('从当前编号开始连续创建，当前下一编号：') + nextNumber),
				this.renderBatchValue(_('Wi-Fi 名称前缀'), 'vlanap_batch_ssid_prefix',
					E('input', { 'id': 'vlanap_batch_ssid_prefix', 'class': 'cbi-input-text', 'value': 'WiFi', 'placeholder': 'WiFi' }),
					_('例如：WiFi5、WiFi6，可在创建后单独修改。')),
				this.renderBatchValue(_('统一 Wi-Fi 密码'), 'vlanap_batch_key',
					E('input', { 'id': 'vlanap_batch_key', 'class': 'cbi-input-password', 'type': 'password', 'placeholder': _('至少 8 位') })),
				this.renderBatchValue(_('写入方式'), null,
					E('label', {}, [
						E('input', { 'id': 'vlanap_batch_append', 'type': 'checkbox', 'checked': 'checked' }),
						' ',
						_('追加到现有配置')
					]))
			]),
			this.renderBatchSection(_('网络接口'), [
				this.renderBatchValue(_('上联网口'), 'vlanap_batch_uplink',
					E('input', { 'id': 'vlanap_batch_uplink', 'class': 'cbi-input-text', 'value': 'lan1', 'placeholder': 'lan1' }),
					_('连接上级路由或主网络。')),
				this.renderBatchValue(_('有线接入口'), 'vlanap_batch_access_ports',
					E('input', { 'id': 'vlanap_batch_access_ports', 'class': 'cbi-input-text', 'value': 'lan3,lan4', 'placeholder': 'lan3,lan4' }),
					_('可留空；多个网口用英文逗号分隔。'))
			]),
			E('details', { 'class': 'cbi-section' }, [
				E('summary', {}, _('网络参数')),
				this.renderBatchValue(_('内部网络前缀'), 'vlanap_batch_network_prefix',
					E('input', { 'id': 'vlanap_batch_network_prefix', 'class': 'cbi-input-text', 'value': 'vlan', 'placeholder': 'vlan' }),
					_('默认 vlan，会生成 vlan5、vlan6。')),
				this.renderBatchValue(_('编号间隔'), 'vlanap_batch_step',
					E('input', { 'id': 'vlanap_batch_step', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'value': '1', 'style': 'width:7em' }),
					_('默认 1，表示连续编号。')),
				this.renderBatchValue(_('MAC 处理'), 'vlanap_batch_mac_mode',
					E('select', { 'id': 'vlanap_batch_mac_mode', 'class': 'cbi-input-select' }, [
						E('option', { 'value': 'auto', 'selected': 'selected' }, _('自动处理')),
						E('option', { 'value': 'random' }, _('每个 Wi-Fi 随机生成')),
						E('option', { 'value': 'ap' }, _('按 AP 规则生成')),
						E('option', { 'value': 'vendor' }, _('按厂家号生成'))
					]), _('默认自动处理。'))
			]),
			E('h4', {}, _('生成预览')),
			E('div', { 'style': 'overflow-x:auto' }, [
				E('table', { 'id': 'vlanap_batch_preview', 'class': 'table cbi-section-table', 'style': 'table-layout:fixed; width:100%; min-width:860px' }, [
					E('colgroup', {}, [
						E('col', { 'style': 'width:15%' }),
						E('col', { 'style': 'width:13%' }),
						E('col', { 'style': 'width:13%' }),
						E('col', { 'style': 'width:12%' }),
						E('col', { 'style': 'width:12%' }),
						E('col', { 'style': 'width:12%' }),
						E('col', { 'style': 'width:11%' }),
						E('col', { 'style': 'width:12%' })
					]),
					E('thead', {}, E('tr', {}, [
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('名称')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('绑定网络')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('SSID')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('加密')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('密码')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('MAC 地址')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('客户端隔离')),
						E('th', { 'style': 'padding:3px 10px; text-align:left; white-space:nowrap' }, _('隐藏 SSID'))
					])),
					E('tbody', {}, this.renderBatchPreviewRows())
				])
			])
		]);

		modal = ui.showModal(_('批量创建 Wi-Fi'), [
			body,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('取消')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-action important', 'click': ui.createHandlerFn(this, 'handleBatchGenerate') }, _('生成配置'))
			])
		]);
		modal.style.width = 'min(1000px, 94vw)';
		modal.style.maxWidth = '1000px';

		this.bindBatchPreview();
	},

	renderWifiToolbar: function(statusText) {
		var nextNumber = this.getNextWifiNumber(statusText);

		return E('div', { 'class': 'cbi-section-descr', 'style': 'display:flex; justify-content:flex-end; gap:.5em; flex-wrap:wrap; margin-bottom:.75em' }, [
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-add',
				'click': function(ev) {
					var wifiSection = document.querySelector('#cbi-vlanap-wifi');
					var section = wifiSection ? dom.findClassInstance(wifiSection) : null;
					var sectionId = 'vlan' + nextNumber + '_wifi';

					if (section) {
						sectionId = section.map.data.add('vlanap', 'wifi', sectionId);
						section.map.data.set('vlanap', sectionId, 'network', 'vlan' + nextNumber);
						section.map.data.set('vlanap', sectionId, 'ssid', 'WiFi' + nextNumber);
						section.map.data.set('vlanap', sectionId, 'encryption', 'psk2+ccmp');
						section.map.addedSection = sectionId;
						return section.renderMoreOptionsModal(sectionId);
					}
				}
			}, _('新增 Wi-Fi')),
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-action',
				'click': L.bind(function() { return this.showBatchCreateModal(statusText); }, this)
			}, _('批量创建 Wi-Fi')),
			E('button', {
				'type': 'button',
				'class': 'btn cbi-button cbi-button-save',
				'click': ui.createHandlerFn(this, 'handleGenerateSelectedMac')
			}, _('一键切换 MAC'))
		]);
	},

	addWifiToolbar: function(renderedMap, statusText) {
		var wifiSection = renderedMap.querySelector('#cbi-vlanap-wifi');
		var heading;
		var selectHeader;
		var selectAll;
		var selectIndex;
		var rows;
		var cell;
		var i;

		if (!wifiSection || wifiSection.querySelector('.vlanap-wifi-toolbar'))
			return renderedMap;

		heading = wifiSection.querySelector('h3');
		wifiSection.insertBefore(E('div', { 'class': 'vlanap-wifi-toolbar' }, [
			this.renderWifiToolbar(statusText)
		]), heading ? heading.nextSibling : wifiSection.firstChild);

		selectHeader = wifiSection.querySelector('th[data-widget="CBI.DummyValue"]');
		if (selectHeader) {
			selectIndex = Array.prototype.indexOf.call(selectHeader.parentNode.children, selectHeader);
			selectAll = E('input', {
				'type': 'checkbox',
				'title': _('全选'),
				'change': ui.createHandlerFn(this, 'handleSelectAllWifi')
			});
			selectHeader.textContent = '';
			selectHeader.removeAttribute('data-sortable-row');
			selectHeader.removeAttribute('data-sort-direction');
			selectHeader.onclick = null;
			selectHeader.style.cursor = 'default';
			selectHeader.classList.remove('flash');
			selectHeader.appendChild(selectAll);

			if (selectIndex > 0)
				selectHeader.parentNode.insertBefore(selectHeader, selectHeader.parentNode.firstElementChild);

			rows = wifiSection.querySelectorAll('tr.cbi-section-table-row');
			for (i = 0; i < rows.length; i++) {
				cell = rows[i].children[selectIndex];
				if (cell && selectIndex > 0)
					rows[i].insertBefore(cell, rows[i].firstElementChild);
			}
		}

		return renderedMap;
	},

	render: function(status) {
		var m, s, o;
		var statusText = [ status.stdout, status.stderr ].filter(Boolean).join('\n');

		m = new form.Map('vlanap', _('VLAN AP'), _('OpenWrt 只负责 Wi-Fi/网口和 VLAN 映射，RouterOS 负责网关、DHCP、DNS 和防火墙。'));
		m.tabbed = true;

		s = m.section(form.GridSection, 'wifi', _('Wi-Fi 列表'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('新增 Wi-Fi');

		o = s.option(form.DummyValue, '_select', _('选择'));
		o.textvalue = function(section_id) {
			return E('input', {
				'type': 'checkbox',
				'class': 'vlanap-wifi-select-row',
				'data-section': section_id
			});
		};

		o = s.option(form.Value, 'network', _('绑定网络'));
		o.datatype = 'uciname';

		o = s.option(form.Value, 'ssid', _('SSID'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'encryption', _('加密'));
		o.value('psk2+ccmp', 'WPA2-PSK');
		o.value('sae-mixed', 'WPA2/WPA3');
		o.value('none', _('开放'));
		o.default = 'psk2+ccmp';

		o = s.option(form.Value, 'key', _('密码'));
		o.password = true;
		o.depends('encryption', 'psk2+ccmp');
		o.depends('encryption', 'sae-mixed');

		o = s.option(form.Value, 'macaddr', _('MAC 地址'));
		o.placeholder = _('自动');
		o.validate = function(section_id, value) {
			var first;

			if (!value)
				return true;

			if (!/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/.test(value))
				return _('请输入合法的 MAC 地址。');

			first = parseInt(value.substr(0, 2), 16);
			if (first & 1)
				return _('MAC 必须是单播地址。');

			return true;
		};

		o = s.option(form.Button, '_mac_generate', _('换 MAC'));
		o.inputtitle = _('生成');
		o.inputstyle = 'apply';
		o.onclick = L.bind(function(section_id) {
			return this.runVlanap([ 'mac-generate', section_id, 'random' ], _('已生成新的随机 MAC，请检查后点击“安全应用”。')).then(function() {
				window.setTimeout(function() { window.location.reload(); }, 800);
			});
		}, this);

		o = s.option(form.Button, '_mac_clear', _('清空 MAC'));
		o.inputtitle = _('清空');
		o.inputstyle = 'reset';
		o.onclick = L.bind(function(section_id) {
			return this.runVlanap([ 'mac-clear', section_id ], _('已清空 MAC，应用后由驱动自动分配。')).then(function() {
				window.setTimeout(function() { window.location.reload(); }, 800);
			});
		}, this);

		o = s.option(form.Flag, 'isolate', _('客户端隔离'));
		o.default = '0';

		o = s.option(form.Flag, 'hidden', _('隐藏 SSID'));
		o.default = '0';

		s = m.section(form.GridSection, 'vlan', _('VLAN 列表'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('新增 VLAN');

		o = s.option(form.Value, 'id', _('VLAN ID'));
		o.datatype = 'range(1,4094)';

		o = s.option(form.Value, 'network', _('网络名称'));
		o.datatype = 'uciname';

		o = s.option(form.DynamicList, 'tagged_port', _('Tagged 口'));
		o.placeholder = 'lan1';

		o = s.option(form.DynamicList, 'untagged_port', _('Untagged 口'));
		o.placeholder = 'lan2';

		s = m.section(form.NamedSection, 'main', 'global', _('VLAN AP 设置'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('启用'));
		o.default = '1';
		o = s.option(form.Value, 'bridge', _('Bridge'));
		o.default = 'br-vlanap';
		o.validate = function(section_id, value) {
			if (/^[A-Za-z0-9_.-]{1,15}$/.test(value))
				return true;

			return _('请输入合法的 Linux 网桥名，例如 br-vlanap。');
		};

		o = s.option(form.Value, 'uplink', _('RouterOS 上联口'));
		o.default = 'lan1';
		o.placeholder = 'lan1';

		o = s.option(form.Value, 'manage_network', _('管理网络'));
		o.default = 'vlan254';
		o.datatype = 'uciname';

		o = s.option(form.Value, 'manage_vlan', _('管理 VLAN'));
		o.default = '254';
		o.datatype = 'range(1,4094)';

		o = s.option(form.Value, 'manage_ip', _('管理 IP'));
		o.default = '172.16.254.254';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'manage_netmask', _('子网掩码'));
		o.default = '255.255.255.0';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'gateway', _('网关'));
		o.default = '172.16.254.1';
		o.datatype = 'or(ip4addr,blank)';

		o = s.option(form.Value, 'dns', _('DNS'));
		o.default = '172.16.254.1';
		o.datatype = 'or(ip4addr,blank)';

		o = s.option(form.Value, 'safe_timeout', _('安全回滚秒数'));
		o.default = '180';
		o.datatype = 'uinteger';

		o = s.option(form.Flag, 'disable_existing_wifi', _('禁用原有 Wi-Fi'));
		o.default = '1';

		o = s.option(form.Flag, 'disable_all_dhcp', _('关闭本机 DHCP'));
		o.default = '1';

		o = s.option(form.Button, '_apply_safe', _('安全应用'));
		o.inputtitle = _('安全应用');
		o.inputstyle = 'apply';
		o.onclick = L.bind(function(section_id) {
			return this.handleApplySafe();
		}, this);

		o = s.option(form.Button, '_confirm', _('确认应用'));
		o.inputtitle = _('确认应用');
		o.inputstyle = 'save';
		o.onclick = L.bind(function(section_id) {
			return this.handleConfirm();
		}, this);

		return m.render().then(L.bind(function(renderedMap) {
			return this.addWifiToolbar(renderedMap, statusText);
		}, this));
	}
});
