from datetime import date

def naturalday(ts, ts_format=None):
    delta = ts.date() - date.today()
    if not delta.days:
        return u'today'
    elif delta.days == 1:
        return u'tomorrow'
    elif delta.days == -1:
        return u'yesterday'
    return ts.strftime(ts_format)