import api, { route } from '@forge/api';

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': ['application/json'],
    },
    body: JSON.stringify(data),
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getString(value, fallback = 'Not provided') {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return fallback;
}

export const handleDocsSync = async (req) => {
  try {
    const payload = req?.body ? JSON.parse(req.body) : {};
    const pageId = '21692417';

    const getRes = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}?body-format=storage`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      }
    );

    const getText = await getRes.text();

    if (!getRes.ok) {
      return jsonResponse(500, {
        step: 'get-page',
        ok: getRes.ok,
        status: getRes.status,
        statusText: getRes.statusText,
        response: getText,
      });
    }

    const pageData = JSON.parse(getText);

    const currentTitle = pageData.title;
    const currentVersion = pageData.version.number;
    const spaceId = pageData.spaceId;
    const existingBody = pageData.body?.storage?.value || '';

    const updatedAt = new Date().toISOString();
    const eventType = getString(payload.eventType || payload.event_type || payload.type, 'manual-test');
    const source = getString(payload.source, 'unknown');
    const summary = getString(payload.summary || payload.message || payload.description, 'No summary provided');
    const feature = getString(payload.feature || payload.page || payload.area, 'Not specified');

    const rawPayload = escapeHtml(JSON.stringify(payload, null, 2));

    const newEntry = `
      <hr />
      <h2>Documentation Update</h2>
      <table data-layout="default">
        <tbody>
          <tr>
            <th><p>Event Type</p></th>
            <td><p>${escapeHtml(eventType)}</p></td>
          </tr>
          <tr>
            <th><p>Source</p></th>
            <td><p>${escapeHtml(source)}</p></td>
          </tr>
          <tr>
            <th><p>Feature / Area</p></th>
            <td><p>${escapeHtml(feature)}</p></td>
          </tr>
          <tr>
            <th><p>Summary</p></th>
            <td><p>${escapeHtml(summary)}</p></td>
          </tr>
          <tr>
            <th><p>Updated At</p></th>
            <td><p>${escapeHtml(updatedAt)}</p></td>
          </tr>
        </tbody>
      </table>

      <ac:structured-macro ac:name="expand">
        <ac:parameter ac:name="title">Raw payload</ac:parameter>
        <ac:rich-text-body>
          <pre>${rawPayload}</pre>
        </ac:rich-text-body>
      </ac:structured-macro>
    `;

    const updatedBody = `
      ${existingBody}
      ${newEntry}
    `;

    const updateRes = await api.asApp().requestConfluence(
      route`/wiki/api/v2/pages/${pageId}`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: pageId,
          status: 'current',
          title: currentTitle,
          spaceId,
          version: {
            number: currentVersion + 1,
          },
          body: {
            representation: 'storage',
            value: updatedBody,
          },
        }),
      }
    );

    const updateText = await updateRes.text();

    return jsonResponse(200, {
      step: 'structured-append-page-update',
      ok: updateRes.ok,
      status: updateRes.status,
      statusText: updateRes.statusText,
      response: updateText,
    });
  } catch (err) {
    return jsonResponse(500, {
      error: err.message,
      stack: err.stack,
    });
  }
};