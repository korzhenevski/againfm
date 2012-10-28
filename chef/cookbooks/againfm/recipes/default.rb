#
# Cookbook Name:: againfm
# Recipe:: default
#

package 'libevent-dev'

directory '/var/www/againfm' do
    owner "www-data"
    group "www-data"
    mode "775"
    recursive true
end

if node[:instance_role] == 'vagrant'
    include_recipe "againfm::dev"
else
    include_recipe "againfm::production"
end