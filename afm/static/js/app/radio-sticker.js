/**
 * статус имеет 4 состояния
 *  загрузка
 *  трек-инфо
 *  инфа недоступна
 *  радио недоступно
 */


var App = App || {};

App.Sticker = App.klass({
    data: {
        image_url: 'http://placehold.it/80x80',
        title: 'Loading...',
        subtitle: '',
        star_class: ''
    },
    mediator: App.mediator,

    initialize: function() {
        this.mediator.on('radio:station_changed', function(station) {
            // TODO: тут черти. какого-то хера без клонирования не срабатывает change
            this.setData({
                title: App.i18n('radio.loading'),
                subtitle: '',
                station: station
            });
        }, this);

        this.mediator.on('player:error radio:error', function(){
            this.setData({
                title: App.i18n('error.radio_unavailable'),
                subtitle: ''
            });
        }, this);
    },

    toggleFavoriteStation: function() {
        var data = this.data;
        data.station.favorite = !data.station.favorite;
        this.setData(data);
        $.post('/api/user/favorite/station/' + data.station.id);
    },

    setData: function(data) {
        this.data = $.extend(this.data, data);
        console.log(this.data);
        this.trigger('change');
    }
});

App.StickerView = App.View.extend({
    el: '.radio-sticker',
    template: App.getTemplate('sticker'),
    events: {
        'click .station': 'toggleStation'
    },

    initialize: function() {
        this.model = new App.Sticker();
        this.model.on('change', this.render, this);
    },

    render: function() {
        var context = this.model.data;
        this.$el.show().html(this.template(context));
    },

    toggleStation: function() {
        this.model.toggleFavoriteStation();
    }
});

$(function(){
    App.sticker = new App.StickerView();
});