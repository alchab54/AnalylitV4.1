export async function apiGet(url, params) {
    const q = params ? `?${new URLSearchParams(params)}` : '';
    const r = await fetch(url + q);
    if (!r.ok) {
        throw new Error(`GET ${url} ${r.status}`);
    }
    return r.json();
}

export async function apiPost(url, data) {
    const r = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!r.ok) {
        throw new Error(`POST ${url} ${r.status}`);
    }
    return r.json();
}
