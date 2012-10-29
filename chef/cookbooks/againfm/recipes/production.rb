#
# Cookbook Name:: againfm
# Recipe:: production
#

package "uwsgi"
package "uwsgi-plugin-python"

directory "/var/www/againfm/current" do
  owner "www-data"
  group "www-data"
  mode 0755
  recursive true
end

execute "chown -R www-data:www-data /var/www/againfm/current/"

service "uwsgi" do
  supports :status => true, :restart => true, :reload => true
  action [ :enable, :start ]
end

directory "/var/log/againfm" do
  owner "www-data"
  group "www-data"
  mode 0755
  recursive true
end

supervisor_service "celery" do
  action :enable
  user "www-data"
  directory "/var/www/againfm/current/"
  command "/var/www/againfm/current/venv/bin/celery -A afm.celery worker -l info"
  startretries 100000
  autorestart true
  redirect_stderr true
  stdout_logfile "/var/log/againfm/celery.log"
end

template "/etc/uwsgi/apps-enabled/againfm.ini" do
  source "production-uwsgi.ini.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[uwsgi]", :immediately
end

template "#{node[:nginx][:dir]}/sites-available/againfm.conf" do
  source "production-nginx.conf.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[nginx]", :immediately
end

nginx_site "againfm.conf"