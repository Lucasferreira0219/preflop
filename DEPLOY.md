# Deploy — Preflop Trainer (web)

App roda em duas formas com a mesma codebase:

| Modo     | Comando             | Para que serve                  |
|----------|---------------------|---------------------------------|
| Desktop  | `python launcher.py` | Janela nativa (pywebview)       |
| Web      | `python server.py`   | Servidor HTTP (FastAPI/uvicorn) |

## 1. Instalar dependências

```bash
pip install -r requirements.txt
```

## 2. Rodar local pra testar

```bash
python server.py
# abrir http://localhost:8000
```

## 3. Deploy no seu servidor

### Opção A — uvicorn direto + nginx reverse proxy

Subir o app:
```bash
# Recomendo systemd pra manter rodando — exemplo: /etc/systemd/system/preflop.service
[Unit]
Description=Preflop Trainer
After=network.target

[Service]
User=seu_usuario
WorkingDirectory=/caminho/para/preflop
ExecStart=/caminho/para/python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1
Restart=on-failure
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now preflop
```

Nginx (`/etc/nginx/sites-available/preflop.conf`):
```nginx
server {
    listen 80;
    server_name preflop.seu-dominio.com;

    # Redirect HTTP → HTTPS (depois que tiver cert)
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/preflop.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

HTTPS com Let's Encrypt:
```bash
sudo certbot --nginx -d preflop.seu-dominio.com
```

### Opção B — Caddy (mais simples, HTTPS automático)

`/etc/caddy/Caddyfile`:
```
preflop.seu-dominio.com {
    reverse_proxy 127.0.0.1:8000
}
```

```bash
sudo systemctl reload caddy
```

## 4. IMPORTANTE — limitações da versão web atual

- **Single user**: a versão web usa estado global (`_current_question` em `simulator_api.py`).
  Se dois usuários acessarem ao mesmo tempo, vão se confundir. Mantenha `--workers 1`
  e idealmente acesso restrito (basic auth no nginx, IP allowlist, etc).
- **Stats compartilhados**: o SQLite (`data/preflop.db`) é único. Quem entrar no site
  vê e modifica as estatísticas. Não compartilhe o link publicamente.
- Pra adicionar autenticação / multi-user, precisaria de sessão por usuário + auth +
  schema com `user_id` nas tabelas.

## 5. Backup do banco

Os attempts ficam em `data/preflop.db`. Backup simples:
```bash
sqlite3 data/preflop.db ".backup /caminho/backup/preflop-$(date +%F).db"
```
