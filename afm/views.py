from . import app, db, login_manager
from .forms import RegisterForm
from .tasks import send_mail
from flask import jsonify, request, render_template, redirect, url_for
from flask.ext.login import login_user, login_required, current_user, logout_user

# TODO: guards

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
        send_mail.delay(subject='Reset password on Again.FM', email=user.email, body=body)
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
    send_mail.delay(subject='Welcome to Again.FM', email=user.email, body=body)
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

@app.route('/')
def index():
    context = {
        'sitename': 'Again.FM',
        'STATIC_URL': '/static/',
        'bootstrap': {
            'user': {},
            'settings': {}
        }
    }
    if current_user.is_authenticated():
        context['bootstrap']['user'] = current_user.get_public_data()
        context['bootstrap']['settings'] = current_user.settings
    return render_template('index.html', **context)

@app.route('/queue')
def queue():
    send_mail.delay(subject='blabla', email='blabla@testingfdsgdf.com', body='bogus')
    return 'ok'
