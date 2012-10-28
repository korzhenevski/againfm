#
# Cookbook Name:: againfm
# Recipe:: default
#

package "ruby-compass"
package "libfssm-ruby"

if node[:instance_role] == 'vagrant'
    include_recipe "againfm::dev"
else
    include_recipe "againfm::production"
end