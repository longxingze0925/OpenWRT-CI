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

		return this.runVlanap([ 'quick-apply', key ], _('已安全应用。网络可能会切换到 172.16.10.2，请重新登录后点击“确认应用”。'));
	},

	handleApplySafe: function() {
		return this.runVlanap([ 'apply-safe' ], _('已安全应用。请在 180 秒内重新连上管理地址并确认应用。'));
	},

	handleConfirm: function() {
		return this.runVlanap([ 'confirm' ], _('已确认应用，不会自动回滚。'));
	},

	renderQuickPanel: function(statusText) {
		return E('div', { 'class': 'cbi-section' }, [
			E('h3', {}, _('快速创建')),
			E('div', { 'class': 'cbi-section-descr' }, _('默认方案：lan1 接 RouterOS trunk，lan2 是 VLAN 10 管理口，lan3 是 VLAN 30 IoT 口，lan4 是 VLAN 40 访客口。')),
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
		o.datatype = 'uciname';

		o = s.option(form.Value, 'uplink', _('RouterOS 上联口'));
		o.default = 'lan1';
		o.placeholder = 'lan1';

		o = s.option(form.Value, 'manage_network', _('管理网络'));
		o.default = 'home';
		o.datatype = 'uciname';

		o = s.option(form.Value, 'manage_vlan', _('管理 VLAN'));
		o.default = '10';
		o.datatype = 'range(1,4094)';

		o = s.option(form.Value, 'manage_ip', _('管理 IP'));
		o.default = '172.16.10.2';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'manage_netmask', _('子网掩码'));
		o.default = '255.255.255.0';
		o.datatype = 'ip4addr';

		o = s.option(form.Value, 'gateway', _('网关'));
		o.default = '172.16.10.1';
		o.datatype = 'or(ip4addr,blank)';

		o = s.option(form.Value, 'dns', _('DNS'));
		o.default = '172.16.10.1';
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
