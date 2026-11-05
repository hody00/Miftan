"""Conservative Hebrew property extraction. Unknown is always None."""
import hashlib
import re

CITIES = ['תל אביב','רמת גן','גבעתיים','ירושלים','חיפה','באר שבע','ראשון לציון','פתח תקווה','הרצליה','רמת השרון','כפר סבא','רעננה','הוד השרון','נתניה','חולון','בת ים','רחובות','נס ציונה','מודיעין','אשדוד','אשקלון','חדרה','נהריה','עכו','אילת','טבריה','עפולה','כרמיאל','רמלה','לוד','יבנה','גדרה','קריית אונו','גני תקווה','אור יהודה','יהוד','בני ברק','בית שמש','פרדס חנה','זכרון יעקב','קריית מוצקין','קריית ביאליק','קריית אתא','קריית ים','נשר','טירת כרמל']

def redact(text):
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '[פרטי קשר במקור]', text)
    text = re.sub(r'(?<!\d)(?:\+972[\s-]?|0)(?:5\d|[23489])[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)', '[פרטי קשר במקור]', text)
    return text.strip()

def sale_price(text):
    """Select an asking price, excluding rent/income and other financial amounts.

    Never infer a sale price from yield or from how large a number looks.
    Conflicting unqualified prices remain unknown.
    """
    if re.search(r'תקציב רכישה|מחפש(?:ת|ים|ות)?\s+(?:עסקאות|דירות)',text):return None
    number=r'(?:\d{1,3}(?:[, .]\d{3})+|\d+(?:[.,]\d+)?)'
    money=re.compile(r'(?<![\d.,])(?P<prefix>₪\s*)?(?P<number>'+number+r')\s*(?P<unit>מיליונים|מיליון|מליון|אלף|אלפים|₪|ש[״"\x27]?ח|שקלים)?')
    sale=re.compile(r'מחיר(?:\s+(?:מכירה|מבוקש|שיווק|הנכס|הדירה|הבית|חדש|סופי|של|הוא))*|מבוקש|למכירה')
    other=re.compile(r'שכירות|שכר\s*דירה|שכ[״"]ד|מושכר\w*|מכניס\w*|הכנס\w*|מניב\w*|תשואה|לחודש|חודשי\w*|לשנה|שנתי\w*|משכנת\w*|החזר\w*|הון עצמי|מקדמה|פיקדון|ארנונה|ועד בית|שיפוץ|הנחה|הפחתה|מחיר קודם|מחיר ישן|במקום|בעבר')
    candidates=set()
    financial_context=bool(re.search(r'שכירות|שכר\s*דירה|שכ[״"]ד|מושכר\w*|מכניס\w*|הכנס\w*|מניב\w*|לחודש|חודשי\w*',text))
    pending_sale=False
    # Decimal points and thousands separators stay inside a clause.
    for clause in re.split(r'[\n;!?]|(?<!\d)[.,]|[.,](?!\d)',text):
        previous_end=0
        matches=list(money.finditer(clause))
        if not matches:
            if clause.strip():pending_sale=bool(re.search(r'מחיר|מבוקש',clause) and not other.search(clause))
            continue
        for match in matches:
            before=clause[previous_end:match.start()]
            after=clause[match.end():]
            previous_end=match.end()
            unit=match['unit']
            if re.search(r'דמי\s*תיווך|עמלת\s*תיווך',before):continue
            sale_cues=list(sale.finditer(before))
            other_cues=list(other.finditer(before))
            explicit=bool(sale_cues and (not other_cues or sale_cues[-1].start()>other_cues[-1].start()))
            if not before.strip() and pending_sale:explicit=True
            if other_cues and not explicit:continue
            if financial_context and not explicit:continue
            if re.search(r'(?:למ[״"]?ר|למטר)\s*[:=\-]?\s*$',before):continue
            if re.match(r'\s*(?:[/ב]?חודש|לחודש|לחודשיים|לשנה|בשנה|חודשי|שנתי|שכירות|שכר דירה|למ[״"]?ר|למטר)',after):continue
            if re.match(r'\s*(?:חדר|מ[״"]ר|מטר|קומות|יחידות|%)',after):continue
            if re.match(r'\s*(?:₪|ש[״"]?ח)?\s*(?:[בל]שיפוץ|הון עצמי|מקדמה|דמי תיווך)',after):continue
            if not (unit or match['prefix']):
                if not explicit or (sale_cues and not re.fullmatch(r'[\s:=\-–]*ב?\s*',before[sale_cues[-1].end():])):continue
            raw=match['number'].replace(' ','')
            if re.fullmatch(r'\d{1,3}(?:[,\.]\d{3})+',raw):value=float(raw.replace(',','').replace('.',''))
            else:value=float(raw.replace(',','.'))
            if unit in ('מיליונים','מיליון','מליון'):value*=1000000
            elif unit in ('אלף','אלפים'):value*=1000
            if value>0 and value.is_integer():candidates.add(int(value))
        pending_sale=False
    return next(iter(candidates)) if len(candidates)==1 else None

def parse(text):
    text = text.replace('\u200f', '').replace('\u200e', '').replace('תל-אביב','תל אביב').replace('ת״א','תל אביב').replace('ת"א','תל אביב')
    wanted = bool(re.search(r'(?:מחפש(?:ת|ים|ות)?|דרוש(?:ה|ים|ות)?)\s+(?:דירה|בית|נכס|יחידת)',text))
    kind = 'sale' if re.search(r'למכירה|למכור', text) else 'rent' if re.search(r'להשכרה|להשכיר|סאבלט|שכירות|שכר דירה|שכ״ד|שכ"ד',text) else None
    is_property = bool(re.search(r'דיר[הת]|בית|יחיד[הת]|פנטהאוז|סטודיו|דופלקס|חדרים',text)) and not wanted
    city = next((c for c in sorted(CITIES,key=len,reverse=True) if re.search(r'(?<![א-ת])(?:ב|ל|מ)?'+re.escape(c)+r'(?![א-ת])',text)),None)
    rooms = re.search(r'(\d{1,2}(?:[.,]5)?)\s*(?:חדרים|חדרי|חד[\u05f3\u05f4\x27\x22])',text)
    area = re.search(r'(\d{2,4}(?:\.\d+)?)\s*(?:מ[\u05f3\u05f4\x27\x22]{0,2}ר|מטר(?:ים)? רבוע)',text)
    amount = re.search(r'(\d[\d,]{2,10})\s*(?:₪|ש[\u05f3\u05f4\x27\x22]?ח|שקלים)',text)
    if not amount:
        amount = re.search(r'(?:מחיר|שכר דירה|שכ[\u05f4\x22]ד)\s*[:\-]?\s*(\d[\d,]{2,10})',text)
    price = int(amount.group(1).replace(',','')) if amount else None
    if kind=='sale':
        price=sale_price(text)
    neighborhood=re.search(r'(?:בשכונת|שכונת|שכונה)\s+([א-ת][א-ת \-]{1,35}?)(?=[,\.\n]|$)',text)
    amenities={}
    for key,word in [('balcony','מרפסת'),('parking','חניה'),('elevator','מעלית'),('shelter','ממ[״"]ד'),('furnished','מרוהטת')]:
        if re.search(word,text) and not re.search(r'(?:ללא|אין|בלי)\s+(?:\S+\s+)?'+word,text): amenities[key]=True
    clean=redact(text)
    room_value=float(rooms.group(1).replace(',','.')) if rooms else None
    if room_value is not None and room_value>30:room_value=None
    title=(('דירת '+str(room_value).removesuffix('.0')+' חדרים') if room_value else 'בית')+(' להשכרה' if kind=='rent' else ' למכירה' if kind=='sale' else '')+(' ב'+city if city else '')
    # Exact substantive content only; never merge using price and room count alone.
    # Keep contacts in the private hash: redaction can make different ads identical.
    normalized=re.sub(r'\s+',' ',text).strip().casefold()
    fingerprint=hashlib.sha256(normalized.encode()).hexdigest() if len(normalized)>=20 else None
    area_value=float(area.group(1)) if area else None
    score=sum([bool(kind),bool(price and price>0),bool((room_value and room_value>0) or (area_value and area_value>0)),bool(city)])
    return {'title':title,'body':clean,'kind':kind,'city':city,'neighborhood':neighborhood.group(1).strip() if neighborhood else None,'price':price,'rooms':room_value,'area':area_value,'amenities':amenities,'status':'published' if is_property and score>=3 else 'review','fingerprint':fingerprint,'is_property':is_property}
