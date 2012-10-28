#
# Cookbook Name:: redis
# Recipe:: _server_install_from_package

case node.platform
when "debian", "ubuntu"
  pkg = "redis-server"
when "redhat", "centos", "scientific", "fedora"
  include_recipe "yum::epel"
  pkg = "redis"
else
  pkg = "redis"
end

package "redis" do
  package_name pkg
  action :install
end
