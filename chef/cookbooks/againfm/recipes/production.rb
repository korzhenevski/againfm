#
# Cookbook Name:: againfm
# Recipe:: production
#

package "uwsgi"
package "uwsgi-plugin-python"

directory "/var/www/againfm" do
  owner "www-data"
  group "www-data"
  mode 0755
  recursive true
end

service "uwsgi" do
  action :start
end

template "/etc/uwsgi/apps-enabled/againfm.ini" do
  source "production-uwsgi.ini.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[uwsgi]"
end

template "#{node[:nginx][:dir]}/sites-available/againfm.conf" do
  source "production-nginx.conf.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[nginx]"
end

nginx_site "againfm.conf"