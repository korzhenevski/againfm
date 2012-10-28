from fabric.api import env, local, run, lcd, cd
from fabric.contrib.files import exists

env.project = '/var/www/againfm'


"""
починить рестарт редиса
починить старт uwsgi
права на /var/www/againfm
(Permission denied: '/var/www/againfm/afm/static/.webassets-cache')
virtualenv и поддержка откатов
"""

def vagrant():
    # change from the default user to 'vagrant'
    env.user = 'vagrant'
    # connect to the port-forwarded ssh
    env.hosts = ['10.0.0.2']
 
    # use vagrant ssh key
    result = local('vagrant ssh-config | grep IdentityFile', capture=True)
    env.key_filename = result.split()[1]
 
def init():
	run('pip install -r {}/requirements.txt'.format(env.project))

def compass():
    local('compass watch afm/static')

def celery():
    local('celery -A afm.celery worker -l info')

def player():
    with lcd('player'):
        local('as3compile --flashversion 10 --output ../afm/static/swf/player.swf player.as')

def handlebars():
    with lcd('afm/static/js'):
        local('handlebars templates/*.handlebars --min --output render.js')

def setup():
    run('aptitude install -y git-core vim-nox ruby1.9.1 ruby1.9.1-dev build-essential python-pip python-dev libevent-dev')
    run('gem install chef --no-ri --no-rdoc')
    if not exists('/var/www'):
        run('mkdir /var/www')
    if exists('/var/www/againfm'):
        run('rm -rf /var/www/againfm')
    with cd('/var/www'):
        run('git clone https://github.com/outself/againfm.git')
        with cd('againfm'):
            run('pip install -r requirements.txt')
            run('mkdir chef/tmp')
            run('chef-solo -c /var/www/againfm/chef/solo.rb -j /var/www/againfm/chef/production.json')
