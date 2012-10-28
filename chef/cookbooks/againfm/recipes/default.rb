#
# Cookbook Name:: againfm
# Recipe:: default
#

package 'libevent-dev'

if node[:instance_role] == 'vagrant'
    include_recipe "againfm::dev"
else
    include_recipe "againfm::production"
end