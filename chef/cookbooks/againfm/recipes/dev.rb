#
# Cookbook Name:: againfm
# Recipe:: dev
#

package "ruby-compass"
package "libfssm-ruby"

template "#{node[:nginx][:dir]}/sites-available/againfm.conf" do
  source "dev-nginx.conf.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[nginx]"
end

nginx_site "againfm.conf"
