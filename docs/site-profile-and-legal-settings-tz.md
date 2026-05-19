# Site Profile And Legal Settings TZ

Дата: 2026-05-19  
Проект: ТЕХАКС  
Область: админка / сайт / юридические данные / публичные контакты / оферта  
Статус: draft / ready for implementation

## 1. Контекст

Сейчас в проекте уже есть рабочая страница настроек:

- [src/pages/admin/AdminSettings.tsx](</E:/work/ru/tehax/s/app/src/pages/admin/AdminSettings.tsx>)
- [api/routers/settings.ts](</E:/work/ru/tehax/s/app/api/routers/settings.ts>)

Но она в основном покрывает:

- доступ и авторизацию;
- AI-настройки;
- интеграции;
- maintenance mode;
- срок резерва.

При этом важные данные магазина и продавца пока размазаны по проекту:

- телефон и контакты в шапке:
  - [src/components/Header.tsx](</E:/work/ru/tehax/s/app/src/components/Header.tsx>)
- телефон и контакты в футере:
  - [src/components/Footer.tsx](</E:/work/ru/tehax/s/app/src/components/Footer.tsx>)
- контакты на публичной странице:
  - [src/pages/ContactsPage.tsx](</E:/work/ru/tehax/s/app/src/pages/ContactsPage.tsx>)
- согласие с офертой на checkout:
  - [src/pages/CheckoutPage.tsx](</E:/work/ru/tehax/s/app/src/pages/CheckoutPage.tsx>)

Юридические и банковские реквизиты продавца пока не оформлены как единый управляемый контур.

Это создаёт несколько проблем:

1. контакты и реквизиты могут расходиться между страницами;
2. изменение телефона или email требует правки кода;
3. оферта и юридические тексты не имеют централизованного source of truth;
4. будущие письма, PDF, документы и интеграции не имеют общего профиля продавца;
5. для админа нет единого места, где можно обновить карточку продавца.

## 2. Цель

Сделать в интернет-магазине единый настраиваемый контур:

- публичных контактов;
- профиля продавца;
- юридических реквизитов;
- банковских реквизитов;
- оферты и связанных правовых текстов;
- повторно используемых данных для checkout, контактов, footer, email и документов.

Главная идея:

`Сайт должен брать контакты, реквизиты и правовые тексты из одного управляемого источника, а не из захардкоженных строк по проекту.`

## 3. Product principles

### 3.1 Single source of truth

Все данные продавца и сайта должны храниться в одном настройочном слое.

### 3.2 Separation of public and legal data

Нужно различать:

- публичные контакты для витрины;
- полные юридические реквизиты для оферты и документов.

### 3.3 No unnecessary schema complexity

Если для задачи достаточно существующего слоя `app_settings`, не нужно вводить новую тяжёлую таблицу.

### 3.4 Reuse first

Один и тот же профиль должен переиспользоваться в:

- Header;
- Footer;
- ContactsPage;
- Checkout;
- будущих PDF / писем / документов;
- интеграциях, где это уместно.

### 3.5 Safe rollout

Нельзя ломать текущие страницы, если новые настройки ещё не заполнены. Нужен fallback на существующие текущие значения до полного заполнения данных.

## 4. Scope

В scope этой фазы входят:

1. backend API настроек профиля сайта и продавца;
2. UI в админке для редактирования этих данных;
3. использование новых настроек в публичных контактах;
4. использование новых настроек в checkout / оферте;
5. подготовка данных для будущих документов и писем.

В scope этой фазы не входят:

1. генерация PDF договоров;
2. полноценный CMS для произвольных юридических документов;
3. версионирование оферты;
4. цифровая подпись документов;
5. сложная редакция документов по ролям.

## 5. Current code touchpoints

На момент ТЗ особенно важны такие точки:

### 5.1 Settings

- [src/pages/admin/AdminSettings.tsx](</E:/work/ru/tehax/s/app/src/pages/admin/AdminSettings.tsx>)
- [api/routers/settings.ts](</E:/work/ru/tehax/s/app/api/routers/settings.ts>)

### 5.2 Public contact surfaces

- [src/components/Header.tsx](</E:/work/ru/tehax/s/app/src/components/Header.tsx>)
- [src/components/Footer.tsx](</E:/work/ru/tehax/s/app/src/components/Footer.tsx>)
- [src/pages/ContactsPage.tsx](</E:/work/ru/tehax/s/app/src/pages/ContactsPage.tsx>)
- [src/components/LeadForm.tsx](</E:/work/ru/tehax/s/app/src/components/LeadForm.tsx>)
- [src/components/StickyBottomBar.tsx](</E:/work/ru/tehax/s/app/src/components/StickyBottomBar.tsx>)

### 5.3 Checkout and trust text

- [src/pages/CheckoutPage.tsx](</E:/work/ru/tehax/s/app/src/pages/CheckoutPage.tsx>)

### 5.4 Stores and contacts

- [src/pages/StoresPage.tsx](</E:/work/ru/tehax/s/app/src/pages/StoresPage.tsx>)
- [src/components/StoreCard.tsx](</E:/work/ru/tehax/s/app/src/components/StoreCard.tsx>)

## 6. Data model approach

Рекомендуемый подход: использовать существующий слой `app_settings`.

Причины:

1. уже есть рабочие helper’ы:
   - [api/lib/app-settings.ts](</E:/work/ru/tehax/s/app/api/lib/app-settings.ts>)
2. уже есть живой router настроек;
3. не нужна новая таблица только ради конфигурации;
4. rollout будет проще и безопаснее.

### 6.1 Groups of settings

Настройки нужно логически разделить на группы, даже если физически они лежат в одной таблице.

#### Group A. Public contacts

- `site_contact_phone`
- `site_contact_phone_display`
- `site_contact_phone_secondary`
- `site_contact_email`
- `site_contact_working_hours`
- `site_contact_whatsapp`
- `site_contact_telegram`
- `site_contact_address_short`
- `site_contact_address_full`

#### Group B. Seller profile

- `seller_legal_form`
- `seller_full_name`
- `seller_short_name`
- `seller_signatory_name`
- `seller_signatory_label`
- `seller_signatory_basis`
- `seller_legal_address`
- `seller_actual_address`
- `seller_inn`
- `seller_ogrnip`
- `seller_kpp`
- `seller_okpo`
- `seller_email`
- `seller_phone`

#### Group C. Bank details

- `seller_bank_name`
- `seller_bank_account`
- `seller_bank_corr_account`
- `seller_bank_bik`
- `seller_bank_inn`
- `seller_bank_kpp`

#### Group D. Public legal texts

- `offer_title`
- `offer_html`
- `privacy_policy_title`
- `privacy_policy_html`
- `payment_delivery_title`
- `payment_delivery_html`
- `returns_policy_title`
- `returns_policy_html`

#### Group E. Document formatting helpers

- `documents_signature_name`
- `documents_signature_label`
- `documents_signature_image_url` optional
- `documents_requisites_footer`

## 7. Required admin UX

## 7.1 Entry point

Расширить [src/pages/admin/AdminSettings.tsx](</E:/work/ru/tehax/s/app/src/pages/admin/AdminSettings.tsx>) новым крупным блоком в табе `Сайт`.

Рекомендуемая структура внутри таба:

1. `Контакты`
2. `Профиль продавца`
3. `Банк и реквизиты`
4. `Правовые тексты`
5. `Preview`

## 7.2 Contacts form

Поля:

- основной телефон;
- отображаемый формат телефона;
- дополнительный телефон;
- email;
- часы работы;
- короткий адрес;
- полный адрес;
- WhatsApp;
- Telegram.

Требования:

- ввод без лишней перегрузки;
- понятные placeholder’ы;
- soft validation;
- значения можно сохранить независимо от других секций.

## 7.3 Seller profile form

Поля:

- тип продавца:
  - `ИП`
  - `ООО`
- полное наименование;
- краткое наименование;
- ФИО подписанта;
- подпись / сокращённая подпись;
- основание подписания;
- юридический адрес;
- фактический адрес;
- ИНН;
- ОГРНИП / ОГРН;
- КПП;
- ОКПО;
- email;
- телефон.

Требования:

- форма должна сразу поддерживать оба режима:
  - ИП
  - ООО
- поля, неактуальные для ИП, должны быть optional;
- UI не должен путать публичные контакты и юридические реквизиты.

## 7.4 Bank details form

Поля:

- банк;
- расчётный счёт;
- корреспондентский счёт;
- БИК;
- ИНН банка;
- КПП банка.

Требования:

- аккуратная группировка;
- длинные цифровые поля без разъезда layout;
- копируемые значения;
- понятные labels.

## 7.5 Legal texts form

Поля:

- заголовок оферты;
- HTML/richedit контент оферты;
- заголовок политики конфиденциальности;
- HTML/richedit контент политики;
- заголовок блока оплаты и доставки;
- HTML/richedit контент;
- заголовок правил возврата;
- HTML/richedit контент.

Требования:

- не обязательно делать полноценный WYSIWYG в этой фазе;
- допустим контролируемый textarea/HTML editor, если это соответствует текущей архитектуре;
- обязателен preview или хотя бы безопасный рендер рядом;
- хранение и показ должны учитывать будущую санитизацию HTML.

## 7.6 Preview panel

Очень желательно показать компактный preview:

### Preview A. Контакты сайта

- как это будет выглядеть в Header/Footer/Contacts

### Preview B. Реквизиты сторон

- как это будет выглядеть в документном блоке

### Preview C. Checkout trust text

- как это будет видно около оферты

Это сильно снижает вероятность ошибок при вводе реквизитов.

## 8. Backend requirements

Нужно добавить в [api/routers/settings.ts](</E:/work/ru/tehax/s/app/api/routers/settings.ts>) новые методы:

### 8.1 Read

- `getSiteProfileSettings`

Возвращает структурированный объект по группам:

- `contacts`
- `seller`
- `bank`
- `legalTexts`
- `documents`

### 8.2 Write

- `saveSiteProfileSettings`

Сохраняет новые значения в `app_settings`.

### 8.3 Optional helper

- `getPublicSiteProfile`

Публичный read-only endpoint для витрины, который возвращает только безопасные данные:

- телефоны;
- email;
- рабочие часы;
- короткий адрес;
- публичные юридические данные, если они реально нужны на фронте.

Этот endpoint нужен, если мы не хотим тянуть защищённый settings router в публичные компоненты.

## 9. Frontend integration requirements

## 9.1 Header

В [src/components/Header.tsx](</E:/work/ru/tehax/s/app/src/components/Header.tsx>):

- убрать захардкоженный номер;
- брать телефон и часы работы из публичного профиля сайта.

## 9.2 Footer

В [src/components/Footer.tsx](</E:/work/ru/tehax/s/app/src/components/Footer.tsx>):

- убрать захардкоженный телефон;
- добавить публичный email и адрес из профиля;
- не дублировать несовместимые значения.

## 9.3 Contacts page

В [src/pages/ContactsPage.tsx](</E:/work/ru/tehax/s/app/src/pages/ContactsPage.tsx>):

- использовать единый публичный профиль контактов;
- добавить блок “Реквизиты продавца”;
- при необходимости отдельно вывести “Банковские реквизиты”.

## 9.4 Checkout

В [src/pages/CheckoutPage.tsx](</E:/work/ru/tehax/s/app/src/pages/CheckoutPage.tsx>):

- текст согласия с офертой должен ссылаться на управляемую страницу/контент;
- рядом можно использовать публичное имя продавца;
- не захардкоживать старые формулировки, если они должны редактироваться.

## 9.5 Future email/documents

Эта фаза должна подготовить reuse для:

- [api/lib/mail.ts](</E:/work/ru/tehax/s/app/api/lib/mail.ts>)
- будущих PDF / invoices / document exports

То есть backend должен уметь собирать структурированный seller profile без повторной ручной склейки по месту.

## 10. Validation requirements

### 10.1 Contacts

- телефон: мягкая валидация;
- email: стандартная email-валидация;
- WhatsApp / Telegram: optional.

### 10.2 Seller / bank

- ИНН, ОГРНИП, БИК, счета: не делать чрезмерно жёсткую валидацию в первую фазу;
- важнее не ломать ввод существующих реальных значений.

### 10.3 Legal texts

- пустые значения допустимы только там, где есть fallback;
- если оферта не заполнена, checkout не должен падать;
- при этом админка должна явно подсвечивать, что оферта не заполнена.

## 11. Security and content safety

Это особенно важно для legal texts.

### 11.1 HTML safety

Если `offer_html` и другие тексты хранятся как HTML:

- их нельзя рендерить без санитизации;
- нужно использовать серверный или строго контролируемый client-safe rendering path;
- запрещены произвольные script/event-handler вставки.

### 11.2 Settings access

Чтение и запись полных реквизитов должно быть только для ролей с правом:

- `read Settings`
- `configure Settings`

### 11.3 Public endpoint shape

Если вводится публичный endpoint профиля:

- он не должен отдавать приватные токены и интеграционные ключи;
- он должен возвращать только явно разрешённые публичные поля.

## 12. Migration strategy

В базовой реализации новая таблица не нужна.

Нужно:

1. добавить новые ключи в `app_settings` по факту сохранения;
2. не делать destructive migration;
3. предусмотреть fallback на текущие захардкоженные значения до полного заполнения настроек.

## 13. Rollout plan

### Phase 1. Foundation

- backend API для site profile settings;
- admin UI в `AdminSettings`;
- сохранение в `app_settings`.

### Phase 2. Public contacts rollout

- Header;
- Footer;
- ContactsPage;
- StickyBottomBar;
- LeadForm.

### Phase 3. Legal/trust rollout

- Checkout;
- публичная оферта;
- блок реквизитов;
- переиспользуемый seller profile helper.

### Phase 4. Documents and emails

- email reuse;
- документные шаблоны;
- PDF/export readiness.

## 14. Acceptance criteria

1. В админке есть единое место для редактирования контактов, реквизитов и правовых текстов.
2. Телефон и email на сайте больше не захардкожены в Header/Footer/Contacts.
3. Контакты сайта и юридические реквизиты не смешиваются в одну неструктурированную форму.
4. Checkout использует управляемую оферту или безопасный fallback.
5. Оферта и legal texts не ломают сайт при пустом состоянии.
6. Полные реквизиты можно использовать повторно в документах и письмах.
7. Изменение контактов или реквизитов не требует правки frontend-кода.
8. Все изменения additive и совместимы с текущей архитектурой.

## 15. Initial business data to load

На основании переданных данных в систему нужно будет заложить такой initial profile:

### Seller

- ИП Асташкина Татьяна Алексеевна
- Юридический адрес:
  - 442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12
- Фактический адрес:
  - 442963, Пензенская область, г. Заречный, ул. Ленина, д.6, кв.12
- ИНН:
  - 583800160003
- ОГРНИП:
  - 325580000028444
- E-mail:
  - tech.aks@yandex.ru
- Телефон:
  - +7 (927) 364-28-88

### Bank

- Банк ВТБ (ПАО)
- Р/с:
  - 40802810200810092221
- К/с:
  - 30101810145250000411
- БИК:
  - 044525411
- ИНН банка:
  - 7702070139
- КПП банка:
  - 770943002
- ОКПО:
  - 01929672

### Signature

- Подписант:
  - Асташкина Татьяна Алексеевна
- Краткая подпись:
  - Асташкина Т.А.

## 16. Recommended next step

После утверждения этого ТЗ следующим шагом нужно:

1. декомпозировать задачу на GitHub;
2. выделить отдельный milestone для:
   - foundation;
   - public contacts rollout;
   - legal texts rollout;
   - document reuse;
3. только потом переходить к реализации, чтобы не смешать UI, тексты и интеграционные куски в один хаотичный коммит.
