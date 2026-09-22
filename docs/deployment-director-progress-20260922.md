# Director offers and step progress release — 2026-09-22 (Asia/Tashkent)

- Host: `159.223.160.56`, project `/opt/factory-os-v2`.
- Application commit: `1c21184`.
- Active image: `factory-os-v2:director-progress-20260922-1c21184`, also tagged `latest`.
- Image ID: `sha256:524f550d18b510895206824be64b42329124906c90e67cbe35a0050e3017a1fa`.
- Next build ID: `IreHk4bVfkIbMzlmq32k5`.
- Prior image: `factory-os-v2:before-director-progress-20260922-1c21184` (UX release, `ced1cb6d6445`).
- Consistent SQLite backup: `/app/data/before-director-progress-20260922-1c21184.sqlite` in the production volume.
- Release directory: `/opt/factory-os-v2/releases/director-progress-20260922-1c21184`
  (source/build archives, `host-source-before.tar.gz`, backup/verify scripts).
- Package-lock SHA256 unchanged: `a91b36f85c1f2880b9d357632b874676db468ef0ef6d65bdf98b8eb49db91eaf`.
- Source archive SHA256: `1f116bc8947f23d7afa6f89e9dbca8a5864f79c6bf5c9748dfb6fd1bb8d6b564`.
- Build archive SHA256: `df05045d4c0c70b041c243a610a7190932ea6b8028d81b01d9932d61ab7ce537`.

Same layering method as the UX release; no schema migration. A network-disabled
smoke container with Telegram disabled ran on a copy of the backup; director,
procurement head and specialist API/web/Telegram pages passed, then the container
and data copy were removed. The backup confirmed the reported case: `ORD-2026-0021/1`
had two positions at `director` while its aggregate step was `sourcing`.

After cutover: container healthy, image and build ID match, startup DB check passed,
same role checks passed, quick_check ok, rows unchanged (28 orders, 24 quotations,
14 suppliers, 2 finance payments), public UZ/RU login 200, unauthenticated finance API 401.
No production workflow action was executed.

Rollback: tag `factory-os-v2:before-director-progress-20260922-1c21184` as
`factory-os-v2:latest` and run
`docker compose -f docker-compose.production.yml up -d --no-build --force-recreate app`.
Do not automatically restore the database.
