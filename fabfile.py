from fabric.api import env, local, run, lcd

env.project = '/var/www/againfm'

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
    local('compass watch afm/web/static')

def celery():
    local('celery -A afm.web.celery worker -l info')

def player():
    with lcd('player'):
        local('as3compile --flashversion 10 --output ../afm/web/static/swf/player.swf player.as')

def handlebars():
    with lcd('afm/web/static/js'):
        local('handlebars templates/*.handlebars --min --output render.js')