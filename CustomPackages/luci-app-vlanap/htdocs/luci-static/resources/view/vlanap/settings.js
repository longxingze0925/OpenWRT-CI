'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/vlanap', [ 'status' ]).catch(function(err) {
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

	handlePreset: function() {
		var key = document.querySelector('#vlanap_quick_key').value;

		if (!key || key.length < 8) {
			ui.addNotification(null, E('p', {}, _('Wi-Fi 密码至少需要 8 位。')), 'danger');
			return Promise.resolve();
		}

		return this.runVlanap([ 'preset', 'routeros-basic', key ], _('已创建默认 VLAN 方案，请检查后点击“安全应用”。')).then(function() {
			window.setTimeout(function() { window.location.reload(); }, 800);
		});
	},

	handleQuickApply: function() {
		var key = document.querySelector('#vlanap_quick_key').value;

		if (!key || key.length < 8) {
			ui.addNotification(null, E('p', {}, _('Wi-Fi 密码至少需要 8 位。')), 'danger');
			return Promise.resolve();
		}

		return this.runVlanap([ 'quick-apply', key ], _('已安全应用。网络会切换到管理网 172.16.254.254，请重新登录后点击“确认应用”。'));
	},

	handleApplySafe: function() {
		return this.runVlanap([ 'apply-safe' ], _('已安全应用。请在 180 秒内重新连上管理地址并确认应用。'));
	},

	handleConfirm: function() {
		return this.runVlanap([ 'confirm' ], _('已确认应用，不会自动回滚。'));
	},

	handleBatchGenerate: function() {
		var key = document.querySelector('#vlanap_batch_key').value;
		var mode = document.querySelector('#vlanap_batch_append').checked ? 'append' : 'replace';
		var macMode = document.querySelector('#vlanap_batch_mac_mode').value || 'auto';
		var args = [
			'batch-generate',
			document.querySelector('#vlanap_batch_start').value || '1',
			document.querySelector('#vlanap_batch_count').value || '4',
			document.querySelector('#vlanap_batch_step').value || '1',
			document.querySelector('#vlanap_batch_network_prefix').value || 'vlan',
			document.querySelector('#vlanap_batch_ssid_prefix').value || 'WiFi',
			key,
			document.querySelector('#vlanap_batch_uplink').value || 'lan1',
			document.querySelector('#vlanap_batch_access_ports').value || '',
			macMode,
			mode,
			document.querySelector('#vlanap_manage_vlan').value || '254',
			document.querySelector('#vlanap_manage_port').value || 'lan2',
			document.querySelector('#vlanap_ip_prefix').value || '172.16',
			document.querySelector('#vlanap_gateway_host').value || '1',
			document.querySelector('#vlanap_manage_host').value || '254'
		];

		if (!key || key.length < 8) {
			ui.addNotification(null, E('p', {}, _('Wi-Fi 密码至少需要 8 位。')), 'danger');
			return Promise.resolve();
		}

		return this.runVlanap(args, _('已批量生成 VLAN 和 Wi-Fi 配置，请检查后点击“安全应用”。')).then(function() {
			window.setTimeout(function() { window.location.reload(); }, 800);
		});
	},

	handleGenerateAllMac: function() {
		var macMode = document.querySelector('#vlanap_batch_mac_mode').value || 'random';
		return this.runVlanap([ 'mac-generate', 'all', macMode ], _('已为所有 Wi-Fi 生成新的 MAC，请检查后点击“安全应用”。')).then(function() {
			window.setTimeout(function() { window.location.reload(); }, 800);
		});
	},

	handleClearAllMac: function() {
		return this.runVlanap([ 'mac-clear', 'all' ], _('已清空所有 Wi-Fi MAC，应用后由驱动自动分配。')).then(function() {
			window.setTimeout(function() { window.location.reload(); }, 800);
		});
	},

	renderQuickPanel: function(statusText) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('快速创建')),
			E('div', { 'class': 'cbi-section-descr' }, _('默认方案：lan1 接 RouterOS trunk，WiFi-1..WiFi-4 是业务网，WiFi-254/VLAN 254 是管理网，lan2 是管理口。')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title', 'for': 'vlanap_quick_key' }, _('Wi-Fi 密码')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', {
						'id': 'vlanap_quick_key',
						'type': 'password',
						'class': 'cbi-input-password',
						'placeholder': _('至少 8 位')
					})
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, 'handlePreset')
				}, _('一键创建默认 VLAN')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, 'handleQuickApply')
				}, _('一键创建并安全应用')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-save',
					'click': ui.createHandlerFn(this, 'handleApplySafe')
				}, _('安全应用')),
				' ',
				E('button', {
					'class': 'btn cbi-button cbi-button-positive',
					'click': ui.createHandlerFn(this, 'handleConfirm')
				}, _('确认应用'))
			]),
			E('h3', {}, _('批量生成 VLAN 和 Wi-Fi')),
			E('div', { 'class': 'cbi-section-descr' }, _('批量生成只写入配置，不会立即改网络。检查无误后再点击“安全应用”。')),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('VLAN 参数')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', { 'id': 'vlanap_batch_start', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '4094', 'value': '1', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_batch_count', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '32', 'value': '4', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_batch_step', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'value': '1', 'style': 'width: 7em' })
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('命名')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', { 'id': 'vlanap_batch_network_prefix', 'class': 'cbi-input-text', 'value': 'vlan', 'placeholder': 'vlan' }),
					' ',
					E('input', { 'id': 'vlanap_batch_ssid_prefix', 'class': 'cbi-input-text', 'value': 'WiFi', 'placeholder': 'WiFi' })
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('端口和密码')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', { 'id': 'vlanap_batch_uplink', 'class': 'cbi-input-text', 'value': 'lan1', 'placeholder': 'lan1', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_batch_access_ports', 'class': 'cbi-input-text', 'value': 'lan3,lan4', 'placeholder': 'lan3,lan4' }),
					' ',
					E('input', { 'id': 'vlanap_batch_key', 'class': 'cbi-input-password', 'type': 'password', 'placeholder': _('Wi-Fi 密码') })
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('管理网')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('input', { 'id': 'vlanap_manage_vlan', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '4094', 'value': '254', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_manage_port', 'class': 'cbi-input-text', 'value': 'lan2', 'placeholder': 'lan2', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_ip_prefix', 'class': 'cbi-input-text', 'value': '172.16', 'placeholder': '172.16', 'style': 'width: 7em' }),
					' ',
					E('input', { 'id': 'vlanap_gateway_host', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '254', 'value': '1', 'style': 'width: 6em' }),
					' ',
					E('input', { 'id': 'vlanap_manage_host', 'class': 'cbi-input-text', 'type': 'number', 'min': '1', 'max': '254', 'value': '254', 'style': 'width: 6em' })
				])
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('选项')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('select', { 'id': 'vlanap_batch_mac_mode', 'class': 'cbi-input-select' }, [
						E('option', { 'value': 'auto', 'selected': 'selected' }, _('自动 MAC')),
						E('option', { 'value': 'random' }, _('普通随机')),
						E('option', { 'value': 'ap' }, _('商用 AP')),
						E('option', { 'value': 'vendor' }, _('厂家 OUI'))
					]),
					' ',
					E('label', {}, [ E('input', { 'id': 'vlanap_batch_append', 'type': 'checkbox' }), ' ', _('追加') ])
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': ui.createHandlerFn(this, 'handleBatchGenerate') }, _('批量生成')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-save', 'click': ui.createHandlerFn(this, 'handleGenerateAllMac') }, _('全部换一批 MAC')),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.createHandlerFn(this, 'handleClearAllMac') }, _('全部清空 MAC'))
			]),
			E('h3', {}, _('当前状态')),
			E('pre', { 'style': 'white-space: pre-wrap; max-height: 260px; overflow: auto;' }, statusText || _('暂无状态'))
		]);
	},

	render: function(status) {
		var m, s, o;
		var statusText = [ status.stdout, status.stderr ].filter(Boolean).join('\n');

		m = new form.Map('vlanap', _('VLAN AP 设置'), _('OpenWrt 只负责 Wi-Fi/网口和 VLAN 映射，RouterOS 负责网关、DHCP、DNS 和防火墙。'));

		s = m.section(form.NamedSection, 'main', 'global', _('基础设置'));
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

		s = m.section(form.GridSection, 'vlan', _('VLAN 列表'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

		o = s.option(form.Value, 'id', _('VLAN ID'));
		o.datatype = 'range(1,4094)';

		o = s.option(form.Value, 'network', _('网络名称'));
		o.datatype = 'uciname';

		o = s.option(form.DynamicList, 'tagged_port', _('Tagged 口'));
		o.placeholder = 'lan1';

		o = s.option(form.DynamicList, 'untagged_port', _('Untagged 口'));
		o.placeholder = 'lan2';

		s = m.section(form.GridSection, 'wifi', _('Wi-Fi 绑定'));
		s.anonymous = false;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;

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

		return m.render().then(L.bind(function(renderedMap) {
			return E([], [
				this.renderQuickPanel(statusText),
				renderedMap
			]);
		}, this));
	}
});
