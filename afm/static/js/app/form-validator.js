/***
 * Это результат выжимки необходимого функционала из jquery.validation.js
 * только без ебанутого интерфейса и кода писанного чертями
 *
 * @type {function}
 */
var FormValidator = App.klass({
    validators: {
        required: function($el) {
            var val = $.trim($el.val());
            return val && val != $el.attr('placeholder');
        },

        email: function($el) {
            return /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))$/i.test($el.val());
        },

        minlength: function($el, minlen) {
            return $el.val().length >= minlen;
        },

        maxlength: function($el, maxlen) {
            return $el.val().length <= maxlen;
        }
    },

    /**
     * Валидатор.
     *
     * @param form - форма
     * @param options - настройки валидации
     */
    initialize: function(form, options) {
        this.errors = {};
        this.valid = {};
        this.options = options;
        this.form = $(form);
        // валидаторы срабатывают по изменению текста и смене фокуса
        this.form.on('keyup blur', _.bind(this._event, this));
        // блокируем submit если форма невалидна
        this.form.submit(_.bind(function(){
            return this.isValid();
        }, this));
    },

    validateForm: function() {
        _.each(this.options.rules, function(rule, name){
            this.validateField(this.form.find('[name='+name+']'), name);
        }, this);
        this.trigger('validate', this.isValid());
    },

    validateField: function($field, name) {
        var rule = this.options.rules[name];
        var messages = this.options.messages || {};
        delete this.errors[name];
        _.each(rule, function(param, validator_name){
            var validator = this.validators[validator_name];
            if (!validator || this.errors[name]) {
                return;
            }
            if (!validator($field, param)) {
                if (messages[name] && messages[name][validator_name]) {
                    this.errors[name] = messages[name][validator_name];
                } else {
                    this.errors[name] = validator_name + ' error';
                }
            }
        }, this);
        this.valid[name] = !this.errors[name];
    },

    _event: function(e) {
        var $field = $(e.target),
            name = $field.attr('name');
        this.validateField($field, name);
        this.trigger('validate_field', $field, this.errors[name]);
        this.trigger('validate', this.isValid());
    },

    isValid: function() {
        return _.all(_.values(this.valid), _.identity);
    }
});