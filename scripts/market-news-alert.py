#!/usr/bin/env python3
# market-news-alert.py
# Firestore marketPicker 최근 5종목 → 구글 뉴스 RSS → 텔레그램 전송
# 매일 KST 08:00 실행

import os, sys, json, requests, xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import Query

# ── 설정 ────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SA_PATH    = os.path.join(SCRIPT_DIR, 'market-picker-sa.json')
BOT_TOKEN  = '8853855470:AAEvom7zkCbFqlLUTRbE86t35vq5ZSiE2tk'
CHAT_ID    = '8305581057'
KST        = timezone(timedelta(hours=9))

# ── Firebase 초기화 ──────────────────────────────────────────
cred = credentials.Certificate(SA_PATH)
firebase_admin.initialize_app(cred)
db = firestore.client()


def get_top5_stocks():
    docs = (
        db.collection('marketPicker')
          .order_by('date', direction=Query.DESCENDING)
          .limit(5)
          .stream()
    )
    result = []
    for doc in docs:
        d = doc.to_dict()
        result.append({
            'name':   d.get('name', ''),
            'ticker': d.get('ticker', ''),
            'date':   d.get('date', ''),
            'memo':   d.get('memo', ''),
        })
    return result


def get_news(ticker, name, max_items=3):
    """구글 뉴스 RSS에서 최신 뉴스 가져오기"""
    query = f'{ticker} {name}'
    url = (
        'https://news.google.com/rss/search'
        f'?q={requests.utils.quote(query)}'
        '&hl=ko&gl=KR&ceid=KR:ko'
    )
    try:
        r = requests.get(url, timeout=10,
                         headers={'User-Agent': 'Mozilla/5.0'})
        root = ET.fromstring(r.content)
        items = root.findall('.//item')[:max_items]
        news = []
        for item in items:
            title = item.findtext('title', '').split(' - ')[0].strip()
            link  = item.findtext('link', '').strip()
            pub   = item.findtext('pubDate', '').strip()
            # 날짜 간략화 (예: "Sun, 07 Jun 2026 …" → "06-07")
            try:
                dt = datetime.strptime(pub[:16], '%a, %d %b %Y')
                pub_short = dt.strftime('%m-%d')
            except Exception:
                pub_short = ''
            news.append({'title': title, 'link': link, 'pub': pub_short})
        return news
    except Exception as e:
        print(f'[뉴스 오류] {ticker}: {e}', file=sys.stderr)
        return []


def send_telegram(text):
    url = f'https://api.telegram.org/bot{BOT_TOKEN}/sendMessage'
    payload = {
        'chat_id': CHAT_ID,
        'text': text,
        'parse_mode': 'HTML',
        'disable_web_page_preview': True,
    }
    r = requests.post(url, json=payload, timeout=10)
    resp = r.json()
    if not resp.get('ok'):
        print(f'[텔레그램 오류] {resp}', file=sys.stderr)
    return resp


def esc(s):
    return str(s).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def main():
    now = datetime.now(KST)
    date_str = now.strftime('%Y-%m-%d')
    time_str = now.strftime('%H:%M')

    stocks = get_top5_stocks()

    msg  = f'📈 <b>Market Picker 뉴스 브리핑</b>\n'
    msg += f'📅 {date_str} {time_str} KST\n'
    msg += '━━━━━━━━━━━━━━━━━━━━\n\n'

    if not stocks:
        msg += '⚠️ 등록된 종목이 없습니다.'
        send_telegram(msg)
        return

    for i, s in enumerate(stocks, 1):
        name   = esc(s['name'])
        ticker = esc(s['ticker'])
        date   = esc(s['date'])

        msg += f'{i}. <b>{name}</b>  <code>{ticker}</code>\n'
        msg += f'   📆 분석일: {date}\n'

        news = get_news(s['ticker'], s['name'])
        if news:
            for n in news:
                pub_tag = f'[{n["pub"]}] ' if n['pub'] else ''
                msg += f'   • {pub_tag}<a href="{n["link"]}">{esc(n["title"])}</a>\n'
        else:
            msg += '   ℹ️ 최신 뉴스 없음\n'
        msg += '\n'

    send_telegram(msg)
    print('✅ 텔레그램 전송 완료')


if __name__ == '__main__':
    main()
