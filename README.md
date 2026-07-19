# Автономный парсер отзывов

Одноразовый TypeScript CLI собирает публичные отзывы одной организации из Яндекс Карт и 2ГИС, нормализует, дедуплицирует, сортирует и атомарно сохраняет их в `data/reviews.json`. Процесс завершается после синхронизации: сервера, БД и фонового демона нет.

Проекты `W:\VsC\ArtMa` и `W:\VsC\artmaModx` не используются и не изменяются. Интеграция JSON с сайтом, MODX, React, cron или production находится вне этой задачи.

## Требования и установка

- Node.js 20 или новее;
- публичные карточки организаций, доступные без входа;
- доступ в интернет.

```powershell
cd W:\reviews-parser
npm install
Copy-Item .env.example .env
# заполнить .env
```

## Конфигурация

Обязательны URL и цифровой ID выбранного источника: `YANDEX_BUSINESS_URL`, `YANDEX_BUSINESS_ID`, `TWOGIS_BUSINESS_URL`, `TWOGIS_FIRM_ID`. Пути задаются через `REVIEWS_OUTPUT_PATH`, `REVIEWS_RAW_DIR`, `REVIEWS_BACKUP_DIR`; ограничения HTTP — через `REVIEWS_MAX_PAGES`, `REVIEWS_REQUEST_TIMEOUT_MS`, `REVIEWS_REQUEST_DELAY_MS`, `REVIEWS_RETRY_COUNT`, `REVIEWS_USER_AGENT`.

`TWOGIS_REVIEWS_KEY` содержит публичный ключ, который использует веб-клиент 2ГИС. Значение по умолчанию совпадает с проверенным открытым веб-запросом; это не пользовательский токен и не требует аккаунта. При изменении ключа 2ГИС его можно заменить только в `.env`.

## Команды

```powershell
npm test
npm run build
npm run reviews:sync
npm run reviews:sync -- --source=yandex
npm run reviews:sync -- --source=2gis
npm run reviews:sync -- --dry-run
npm run reviews:sync -- --save-raw
npm run reviews:sync -- --allow-empty-source
```

`--dry-run` выполняет live-запросы и валидацию, но не заменяет output. `--save-raw` сохраняет очищенные от CSRF/session, IP, email и публичных ID пользователей ответы в `data/raw`. `--allow-empty-source` явно разрешает заменить существующие записи источника пустым успешным результатом.

## Проверенные публичные запросы

### Яндекс Карты

На 16 июля 2026 года проверен `GET /maps/api/business/fetchReviews`.

1. CLI загружает обычную публичную страницу организации и извлекает созданные Яндексом `csrfToken`, `sessionId` и `x-yandex-req-id` вместе с сессионными cookies.
2. Запрос отзывов содержит `ajax=1`, `businessId`, `csrfToken`, `locale=ru_RU`, `page`, `pageSize=50`, `ranking=by_time`, `reqId`, `sessionId`.
3. Параметр `s` — беззнаковый DJB2-XOR hash точной URL-encoded query string до добавления `s`; это воспроизведение обычного запроса веб-клиента, не обход контроля доступа.
4. Пагинация — целочисленный `page`. Остановка происходит при пустой странице, повторе страницы/ID, отсутствии новых ID или достижении лимита.

Ответ содержит `data.reviews`. Сейчас Яндекс обычно отдаёт только `updatedTime`; если отдельного `createdTime` нет, оно используется как `createdAt`, а `updatedAt` остаётся `null`. Прямая ссылка на конкретный отзыв не конструируется без надёжного публичного шаблона.

### 2ГИС

Проверен `GET https://public-api.reviews.2gis.com/3.0/branches/{firmId}/reviews` с `limit=50`, `rated=true`, `sort_by=date_created`, `locale=ru_RU`, `fields=...` и публичным ключом веб-клиента.

Следующая страница берётся из `meta.next_link`. Если API не вернул ссылку при полной странице, используется документированная фактическим ответом курсорная форма `offset_date=<date_created последнего отзыва>`. Повтор URL/ID, пустая страница и лимит страниц безопасно завершают цикл.

## Output

Файл — версионированный объект `{ schemaVersion: 1, generatedAt, sources, reviews }`. Для каждого источника сохраняются `status`, `fetchedAt`, `count`, `error`. Отзыв содержит детерминированный `id` (`yandex:<externalId>` или `2gis:<externalId>`), автора, рейтинг, текст, даты, фото, ответ организации и `scrapedAt`. Rating-only и повреждённые записи пропускаются. Фото абсолютные и дедуплицированные. Отзывы сортируются по `createdAt` убыванию, затем по `id`.

## Защита последнего успешного результата

Перед запросом читается и валидируется старый output. Ошибка одного источника сохраняет только его прежние отзывы и помечает источник `stale`; успешный второй источник обновляется независимо. Неожиданный нулевой результат также считается stale, пока не передан `--allow-empty-source`. Полный объект валидируется, пишется во временный файл на том же диске, старый файл копируется в `data/backups`, затем выполняется rename. Хранятся 10 последних резервных копий.

## Fixtures и тесты

Fixtures находятся в `fixtures/yandex` и `fixtures/two-gis`; `npm test` не обращается к сети. Для обновления сначала выполнить live-команду с `--save-raw`, вручную удалить пользовательские идентификаторы/лишние поля и перенести минимально нужные формы в fixtures. Автотесты покрывают нормализацию, русские тексты, ответы, фото, плохие записи, защиту пагинации, retry, merge и атомарную запись.

## Ограничения

Оба endpoint являются внутренними публичными endpoint веб-клиентов, а не стабильным официальным API для экспорта. Яндекс может изменить подпись `s`, CSRF/session-разметку или форму `data.reviews`; 2ГИС — ключ, версию, `meta.next_link` или поля отзывов. 401/403, CAPTCHA/challenge, HTML вместо JSON и несовместимая структура прекращают только затронутый источник без обхода защиты. CAPTCHA, proxy rotation, stealth, логин и browser profile не реализованы.

## Еженедельная синхронизация с MODX

Workflow `.github/workflows/sync-reviews.yml` запускается по понедельникам и вручную через `workflow_dispatch`. Он использует реальные команды проекта: `npm ci`, `npm run build`, `npm run reviews:sync`, затем отдельно проверяет output командой `npm run reviews:validate`.

В GitHub Actions Secrets нужно добавить:

- `YANDEX_BUSINESS_ID`, `YANDEX_BUSINESS_URL`, `TWOGIS_FIRM_ID`, `TWOGIS_BUSINESS_URL` и при необходимости `TWOGIS_REVIEWS_KEY`;
- `BEGET_HOST`, `BEGET_PORT`, `BEGET_USER`, `BEGET_SSH_PRIVATE_KEY`;
- `BEGET_SSH_KNOWN_HOSTS` — строку `known_hosts`, заранее полученную и проверенную для сервера Beget;
- `BEGET_REVIEWS_PATH` — полный приватный путь к рабочему `reviews.json` вне `public_html`;
- `BEGET_IMPORT_COMMAND` — полную CLI-команду импортёра, например `php /home/.../reviews-deploy/import-reviews-to-modx.php --modx-root=/home/.../public_html --json=/home/.../private/reviews/reviews.json`.

Для автоматизации следует создать отдельный SSH-ключ с минимально необходимым доступом. JSON сначала загружается рядом с рабочим файлом под уникальным временным именем и повторно проверяется на сервере. Только затем `mv` атомарно заменяет рабочий файл. Перед заменой сохраняется резервная копия; если PHP-импортёр завершится с ошибкой, прежний JSON восстанавливается. Ошибки парсера, локальной проверки или передачи не затрагивают рабочий файл и БД.
