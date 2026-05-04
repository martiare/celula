"""Envio de e-mail via SMTP (Hostinger / qualquer servidor STARTTLS)."""
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config.settings import (
    get_smtp_host, get_smtp_port,
    get_smtp_user, get_smtp_pass, get_smtp_from,
)


def send_email(to: str, subject: str, html: str) -> None:
    """Envia um e-mail HTML. Lança exceção em caso de falha."""
    host  = get_smtp_host()
    port  = get_smtp_port()
    user  = get_smtp_user()
    pwd   = get_smtp_pass()
    from_ = get_smtp_from()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = from_
    msg["To"]      = to
    msg.attach(MIMEText(html, "html", "utf-8"))

    context = ssl.create_default_context()
    with smtplib.SMTP(host, port, timeout=15) as server:
        server.ehlo()
        server.starttls(context=context)
        server.login(user, pwd)
        server.sendmail(from_, to, msg.as_string())


def template_recuperar_senha(nome: str, senha_temp: str, sistema: str = "Visão Célula") -> str:
    return f"""
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px">
      <table width="500" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#2e7d32,#4CAF50);padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:1.4rem;font-weight:800">{sistema}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 12px;font-size:1rem;color:#0f172a">Olá, <strong>{nome}</strong>!</p>
            <p style="margin:0 0 24px;font-size:.95rem;color:#475569">
              Recebemos uma solicitação de recuperação de senha para sua conta.
              Sua senha temporária é:
            </p>
            <div style="background:#f0fdf4;border:2px solid #4CAF50;border-radius:10px;
                        padding:18px;text-align:center;margin-bottom:24px">
              <span style="font-size:1.8rem;font-weight:800;color:#1b5e20;letter-spacing:4px">
                {senha_temp}
              </span>
            </div>
            <p style="margin:0 0 8px;font-size:.88rem;color:#64748b">
              Acesse o sistema e troque essa senha em <strong>Meu Perfil</strong> assim que entrar.
            </p>
            <p style="margin:0;font-size:.82rem;color:#94a3b8">
              Se você não solicitou essa recuperação, ignore este e-mail.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 40px;text-align:center;
                     font-size:.78rem;color:#94a3b8;border-top:1px solid #e2e8f0">
            {sistema} · Enviado automaticamente, não responda este e-mail.
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
