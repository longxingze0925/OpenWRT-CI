include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-vlanap
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_MAINTAINER:=longxingze0925

LUCI_TITLE:=VLAN AP setup page for RouterOS trunk deployments
LUCI_DEPENDS:=+vlanap-core
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
