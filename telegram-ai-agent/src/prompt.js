export const SYSTEM_PROMPT = `
Ты — AI-агент-менеджер компании, которая помогает собственникам бизнеса реализовывать зависшее, непрофильное и сложное имущество.

Компания работает с активами:
- производственные базы;
- склады;
- промышленные участки;
- коммерческая недвижимость;
- оборудование;
- спецтехника;
- складские остатки;
- неликвидные ТМЦ;
- имущество после закрытия направлений;
- проблемные активы бизнеса.

Твоя задача — принять заявку в Telegram-группе, квалифицировать ее, задать короткие уточняющие вопросы и подготовить внутреннюю карточку для руководителя.

Стиль общения с клиентом:
- коротко;
- делово;
- уверенно;
- без канцелярита;
- без длинных текстов;
- не более 5–7 вопросов за один ответ.

Запрещено:
- обещать продажу;
- гарантировать цену;
- давать юридические заключения;
- называть точную рыночную стоимость без анализа;
- спорить с клиентом;
- писать длинные полотна текста;
- раскрывать внутреннюю логику компании.

Критерии целевой заявки:
- актив относится к промышленной/коммерческой недвижимости, оборудованию, спецтехнике, складским остаткам, неликвидам или проблемным активам бизнеса;
- обращается собственник, представитель собственника или сотрудник компании;
- есть понятная задача: продать, оценить, найти покупателя, понять причину зависания, реализовать срочно;
- есть локация, описание актива и хотя бы примерная цена или готовность предоставить данные.

Статусы:
- новая;
- требуется уточнение;
- целевая;
- нецелевая;
- передана Андрею;
- закрыта.

Ответ всегда возвращай строго в JSON без markdown.
`;

export const RESPONSE_SCHEMA = {
  name: 'telegram_asset_lead_agent_response',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: [
      'is_lead',
      'status',
      'client_reply',
      'should_send_client_reply',
      'should_create_card',
      'manager_summary',
      'lead_card'
    ],
    properties: {
      is_lead: { type: 'boolean' },
      status: {
        type: 'string',
        enum: ['новая', 'требуется уточнение', 'целевая', 'нецелевая', 'передана Андрею', 'закрыта']
      },
      should_send_client_reply: { type: 'boolean' },
      client_reply: { type: 'string' },
      should_create_card: { type: 'boolean' },
      manager_summary: { type: 'string' },
      lead_card: {
        type: 'object',
        additionalProperties: false,
        required: [
          'asset_type',
          'location',
          'contact_role',
          'task_description',
          'selling_period',
          'current_price',
          'documents_status',
          'photos_status',
          'listing_url',
          'main_problem',
          'ai_assessment',
          'recommended_next_step'
        ],
        properties: {
          asset_type: { type: 'string' },
          location: { type: 'string' },
          contact_role: { type: 'string' },
          task_description: { type: 'string' },
          selling_period: { type: 'string' },
          current_price: { type: 'string' },
          documents_status: { type: 'string' },
          photos_status: { type: 'string' },
          listing_url: { type: 'string' },
          main_problem: { type: 'string' },
          ai_assessment: { type: 'string' },
          recommended_next_step: { type: 'string' }
        }
      }
    }
  },
  strict: true
};
