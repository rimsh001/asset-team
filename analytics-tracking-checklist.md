# Analytics Tracking Checklist

## 1. Counter
Yandex Metrica counter:
103335143

## 2. Goals

- `lead_form_submit`  
  Name: Отправка формы  
  Trigger: submit of main lead form /api/lead

- `lead_thanks_view`  
  Name: Страница спасибо  
  Trigger: visit to /thanks.html

- `click_request_cta`  
  Name: Клик Оставить заявку  
  Trigger: click on links containing #request

- `click_telegram`  
  Name: Клик Telegram  
  Trigger: click on /api/contact-telegram

- `click_max`  
  Name: Клик MAX  
  Trigger: click on /api/contact-max

- `click_phone`  
  Name: Клик телефон  
  Trigger: click on tel: links

- `click_email`  
  Name: Клик email  
  Trigger: click on mailto: links

## 3. Manual test plan

1. Open https://aateam.ru/?v=metrika-test&_ym_debug=2
2. Click request CTA
3. Click Telegram
4. Click MAX
5. Click phone
6. Click email
7. Submit test lead form with message:  
   Тестовая заявка. Проверка Метрики.
8. Confirm redirect or visit to thanks page
9. Check Yandex Metrica reports:
   - Realtime
   - Conversions
   - Goals

## 4. Expected results

Expected goal events after testing:
- click_request_cta
- click_telegram
- click_max
- click_phone
- click_email
- lead_form_submit
- lead_thanks_view

## 5. Troubleshooting

- Goals may appear with delay.
- If a goal does not appear, check that the goal ID in Yandex Metrica exactly matches the JS identifier.
- Check browser console for Yandex Metrica debug messages.
- Check that script.js on live site contains the latest Metrica goal tracking code.
- Check if cache/CDN is serving old script.js.

## 6. Next optimization step

After 7–14 days of data collection, evaluate:
- which pages get visits;
- which CTAs get clicks;
- which assets generate more interest;
- where users drop off;
- whether the form receives real leads;
- whether Telegram/MAX clicks happen more often than form submissions.
