import pymongo
from . import app, db, login_manager, tasks
from .forms import RegisterForm
from flask import jsonify, request, render_template, redirect, abort
from flask.ext.login import login_user, login_required, current_user, logout_user
from collections import defaultdict
from bson.objectid import ObjectId

# TODO: guards

def send_mail(**kwargs):
    if app.debug:
        # don't send mail in debug env
        return
    return tasks.send_mail.delay(**kwargs)

@login_manager.unauthorized_handler
def unauthorized():
    return jsonify({'error': 'Auth required'}), 401

@app.route('/token_auth/<ObjectId:user_id>/<token>', methods=['GET'])
def token_auth(user_id, token):
    user = db.User.get_from_id(user_id)
    if user and user.confirm_new_password(token):
        login_user(user)
    return redirect('/')

def get_email_provider(email):
    domain = email.split('@')[1].lower()
    for link, domains in app.config['EMAIL_PROVIDERS'].items():
        if domain in domains:
            return link
    return None

@app.route('/api/user/password_reset', methods=['POST'])
def password_reset():
    email = request.form['email']
    user = db.User.find_one({'email': email})
    if user:
        password, token = user.generate_new_password()
        body = render_template('mail/password_reset.html', user=user, password=password, token=token)
        send_mail(subject='Reset password on Again.FM', email=user.email, body=body)
        email_provider = get_email_provider(user.email)
        return jsonify({'email_provider': email_provider, 'status': True})
    return jsonify({'error': {'email': 'No such user'}})

@app.route('/api/user/register', methods=['POST'])
def register():
    form = RegisterForm(request.form)
    if not form.validate():
        return jsonify({'error': form.errors}), 400
    if db.User.find_one({'email': form.email.data}):
        return jsonify({'error': {'email': ['email is already in use']}}), 400
    # create
    user = db.User()
    user.email = form.email.data
    user.set_password(form.password.data)
    user.save()
    # login
    login_user(user)
    # send welcome email
    body = render_template('mail/welcome.html', user=user)
    send_mail(subject='Welcome to Again.FM', email=user.email, body=body)
    return jsonify(user.get_public_data())

@app.route('/api/user/logout', methods=['DELETE'])
@login_required
def logout():
    logout_user()
    return jsonify({'logout': True})

@app.route('/api/user/change_password', methods=['PUT'])
@login_required
def change_password():
    password = request.form['password'].strip()
    if password:
        current_user.set_password(password)
        current_user.save()
    return jsonify(current_user.get_public_data())

@app.route('/api/user/change_name', methods=['PUT'])
@login_required
def change_name():
    name = request.form['name'].strip()
    current_user.name = name
    current_user.save()
    return jsonify(current_user.get_public_data())

@app.route('/api/user/settings', methods=['GET','POST'])
@login_required
def settings():
    if request.method == 'POST':
        current_user.settings = request.json
        current_user.save()
    return jsonify(current_user.settings)

@app.route('/api/user/login', methods=['POST'])
def login():
    data = request.form
    if '@' in data['login']:
        where = {'email': data['login']}
    else:
        where = {'login': data['login']}
    user = db.User.find_one(where)
    if user:
        direct_auth = user.check_password(data['password'])
        new_password_auth = user.confirm_new_password(data['password'])
        if direct_auth or new_password_auth:
            login_user(user)
            return jsonify(user.get_public_data())
        else:
            return jsonify({'error': 'Please check that you have entered your login and password correctly'}), 401
    else:
        return jsonify({'error': 'No such account'}), 401

@app.route('/api/playlist/<ObjectId:category_id>')
def playlist(category_id):
    category = db.Category.get_or_404(category_id)
    stations = [db.Station.get_from_id(station_id).get_public_data() for station_id in category.stations]
    #stations = [{'id': randint(10000, 999999), 'title': unicode(category_id)} for i in xrange(100)]
    return jsonify({'objects': stations})

@app.route('/')
def index():
    categories = [category.get_public_data() for category in db.Category.find({'is_public': True})]
    bootstrap = {
        'user': {},
        'settings': {},
        'categories': categories,
        'playlist': {}
    }
    if current_user.is_authenticated():
        bootstrap['user'] = current_user.get_public_data()
        bootstrap['settings'] = current_user.settings

    bootstrap['playlist'] = [db.Station.get_from_id(ObjectId('501a8ffc1d41c82c22355830')).get_public_data()]
    context = {
        'sitename': 'Again.FM',
        'STATIC_URL': '/static/',
        'bootstrap': bootstrap
    }
    return render_template('index.html', **context)

@app.route('/api/station/<ObjectId:station_id>')
def station_detail(station_id):
    station = db.Station.get_or_404(station_id)
    station = station.get_public_data()
    return jsonify(station.get_public_data())

# http://againfm.local/api/listen/5013ea731d41c80efe0cc300
@app.route('/api/stream_for_station/<ObjectId:station_id>')
def stream_for_station(station_id):
    streams = defaultdict(list)
    if request.args.get('low_bitrate'):
        sort_direction = pymongo.ASCENDING
    else:
        sort_direction = pymongo.DESCENDING
    stream = db.Stream.find_one({'station.$id': station_id}, sort=[('bitrate', sort_direction)])
    if not stream:
        abort(404)
    data = stream.get_public_data()
    data['is_hd'] = 320
    return jsonify(data)
