/**
 * player - [...] - значения которые обновляются переодический
 * рисовалка значений
 *
 * @type {*}
 */


App.RadioSpectrum = App.View.extend({
    el: '#spectrum',
    limit: 300,
    colors: ['#d86b26', '#d72f2e', '#0f9ac5'],
    running: false,

    initialize: function(options) {
        this.player = options.player;
        this.player.on('playing', this.start, this);
        this.player.on('stopped', this.stop, this);
        this.canvas = this.el.getContext('2d');
        _.bindAll(this, 'pullSpectrum', '_updateDimensions', 'drawBlankLine');
        $(window).resize(_.throttle(this._updateDimensions, 200));
        this._updateDimensions();
    },

    _updateDimensions: function() {
        this.width = this.$el.width();
        this.height = this.$el.height();
        this.lineSize = Math.floor(this.limit / this.colors.length);
        this.renderStep = Math.round(this.width / this.lineSize);
    },

    start: function() {
        console.profile('spectrum');
        this.running = true;
        this.spectrum = [];
        this.points = [];
        for (var i = 0; i < this.limit; ++i) {
            this.points[i] = 50;
        }
        this.drawBlankLine();
        //this.animate();
        this.pullSpectrum();
    },

    stop: function() {
        console.profileEnd('spectrum');
        this.running = false;
        this.clear();
        requestAnimFrame(this.drawBlankLine);
    },

    drawBlankLine: function() {
        this.clear();
        var ctx = this.canvas,
            color = '#f3f3f3',
            height = 68;
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 4;

        ctx.moveTo(0, height);
        ctx.lineTo(this.width, height);
        ctx.stroke();
    },

    animate2: function(values, duration, interval) {
        var steps = duration / interval;
        var pointer = 0;
        var stepped;
        var step, from, to;
        function computeStep() {
            if (!values[pointer + 1]) {
                return false;
            }
            from = values[pointer],
            to = values[pointer + 1];
            step = [];
            stepped = steps;
            for (var i = 0; i < from.length; i++) {
                var val = (to[i] - from[i]);
                if (val != 0) {
                    val = val / steps;
                }
                step[i] = val;
            }
            pointer++;
            return true;
        }
        function stepper(){
            var current = [];
            for (var i = 0; i < from.length; i++) {
                from[i] = from[i] + step[i];
                current[i] = parseFloat(from[i].toFixed(2));
            }
            console.log(current);
            if (--stepped) {
                setTimeout(stepper, interval);
            } else {
                if (computeStep()) {
                    setTimeout(stepper, interval);
                }
            }
        }
        computeStep();
        stepper();
    },

    render: function() {
        this.clear();

        for(var lineIndex = 0; lineIndex < this.colors.length; lineIndex++) {
            var pos = 0,
                points = [],
                lim = (lineIndex + 1) * this.lineSize;
            var maxVal = this.height - 10;
            for (var i = lineIndex * this.lineSize; i < lim; i++) {
                var val = this.points[i];
                if (val > maxVal) {
                    val = maxVal;
                }
                if (val < 0) {
                    val = 10;
                }
                points.push([pos, val]);
                pos = pos + this.renderStep;
            }

            this.drawCurve(points, this.colors[lineIndex]);
        }
    },

    drawCurve: function(points, color) {
        var factor = 0.4,
            linewidth = 1,
            ctx = this.canvas;
        ctx.beginPath();

        ctx.shadowColor = color;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 4;

        ctx.strokeStyle = color;
        ctx.lineWidth = linewidth;
        var len = points.length;

        for (var i = 0; i < len; ++i) {
            if (points[i] && typeof(points[i][1]) == 'number' && points[i + 1] && typeof(points[i + 1][1]) == 'number') {
                var coordX = points[i][0];
                var coordY = points[i][1];
                var nextX = points[i + 1][0];
                var nextY = points[i + 1][1];
                var prevX = points[i - 1] ? points[i - 1][0] : null;
                var prevY = points[i - 1] ? points[i - 1][1] : null;
                var offsetX = (points[i + 1][0] - points[i][0]) * factor;
                var offsetY = (points[i + 1][1] - points[i][1]) * factor;

                if (i == 0) {
                    ctx.moveTo(coordX, coordY);
                    ctx.lineTo(nextX - offsetX, nextY - offsetY);
                } else if (nextY == null) {
                    ctx.lineTo(coordX, coordY);
                } else if (prevY == null) {
                    ctx.moveTo(coordX, coordY);
                } else if (coordY == null) {
                    ctx.moveTo(nextX, nextY);
                } else {
                    ctx.quadraticCurveTo(coordX, coordY, coordX + offsetX, coordY + offsetY);
                    if (nextY) {
                        ctx.lineTo(nextX - offsetX, nextY - offsetY);
                    } else {
                        ctx.lineTo(coordX, coordY);
                    }
                }
            } else if (typeof(points[i][1]) == 'number') {
                ctx.lineTo(points[i][0], points[i][1]);
            }
        }
        ctx.stroke();
    },

    pullSpectrum: function() {
        this.spectrum = this.player.engine.getSpectrum(this.limit);
        if (this.running) {
            setTimeout(this.pullSpectrum, 100);
        }
    },

    clear: function() {
        this.canvas.clearRect(0, 0, this.width, this.height);
    }
});

$(function(){
})