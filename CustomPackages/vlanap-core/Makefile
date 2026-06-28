include $(TOPDIR)/rules.mk

PKG_NAME:=vlanap-core
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=longxingze0925

include $(INCLUDE_DIR)/package.mk

define Package/vlanap-core
  SECTION:=net
  CATEGORY:=Network
  TITLE:=DSA VLAN AP helper for RouterOS trunk deployments
  PKGARCH:=all
  DEPENDS:=+uci
endef

define Package/vlanap-core/description
  Configure an OpenWrt device as a DSA VLAN access point. It maps
  Wi-Fi SSIDs and access ports to VLANs, keeps DHCP disabled, and
  hands routing, DHCP, DNS, and firewall policy to an upstream router.
endef

define Build/Compile
endef

define Package/vlanap-core/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/vlanap $(1)/etc/config/vlanap
	$(INSTALL_DIR) $(1)/usr/sbin
	$(INSTALL_BIN) ./files/usr/sbin/vlanap $(1)/usr/sbin/vlanap
endef

$(eval $(call BuildPackage,vlanap-core))
