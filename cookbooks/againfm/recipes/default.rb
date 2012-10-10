#
# Cookbook Name:: againfm
# Recipe:: default
#
# Copyright 2012, Example Com
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

package "ruby-compass"
package "libfssm-ruby"

template "#{node[:nginx][:dir]}/sites-available/againfm.conf" do
  source "againfm.conf.erb"
  owner "root"
  group "root"
  mode 0644
  notifies :reload, "service[nginx]"
end

nginx_site "againfm.conf"