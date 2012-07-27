from wtforms import Form, TextField, validators

class RegisterForm(Form):
    email = TextField('Email', [validators.Required(), validators.Email()])
    password = TextField('Password', [validators.Required()])
