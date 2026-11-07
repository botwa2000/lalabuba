-- /admin/stats "User journeys": one install's drawings, newest first.
CREATE INDEX IF NOT EXISTS generation_log_install_ts_idx ON generation_log (install_id, ts) WHERE install_id IS NOT NULL;
