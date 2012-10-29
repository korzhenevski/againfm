#
# Cookbook Name:: againfm
# Recipe:: default
#

package "libevent-dev"
package "uglifyjs"

if node[:instance_role] == 'vagrant'
    include_recipe "againfm::dev"
else
    include_recipe "againfm::production"
end