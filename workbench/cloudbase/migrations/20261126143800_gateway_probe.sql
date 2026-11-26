-- Disposable HTTP/RPC capability probe. No workbench business data is used.
CREATE SCHEMA wb_gateway_probe;
REVOKE ALL ON SCHEMA wb_gateway_probe FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA wb_gateway_probe TO service_role;

CREATE TABLE wb_gateway_probe.counter (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  next_index INTEGER NOT NULL DEFAULT 0
);
INSERT INTO wb_gateway_probe.counter DEFAULT VALUES;
CREATE TABLE wb_gateway_probe.requests (
  request_id TEXT PRIMARY KEY,
  assigned_index INTEGER NOT NULL UNIQUE
);
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA wb_gateway_probe TO service_role;
ALTER TABLE wb_gateway_probe.counter ENABLE ROW LEVEL SECURITY;
ALTER TABLE wb_gateway_probe.requests ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.wb_gateway_probe_assign(p_request_id TEXT, p_fail BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE v_index INTEGER;
BEGIN
  SELECT next_index INTO v_index FROM wb_gateway_probe.counter WHERE singleton FOR UPDATE;
  SELECT assigned_index INTO v_index FROM wb_gateway_probe.requests WHERE request_id = p_request_id;
  IF FOUND THEN
    RETURN jsonb_build_object('assigned_index', v_index, 'duplicate', TRUE);
  END IF;
  UPDATE wb_gateway_probe.counter SET next_index = next_index + 1 WHERE singleton RETURNING next_index INTO v_index;
  INSERT INTO wb_gateway_probe.requests(request_id, assigned_index) VALUES(p_request_id, v_index);
  IF p_fail THEN
    RAISE EXCEPTION 'WB_PROBE_ROLLBACK';
  END IF;
  RETURN jsonb_build_object('assigned_index', v_index, 'duplicate', FALSE);
END;
$$;

CREATE FUNCTION public.wb_gateway_probe_state()
RETURNS JSONB LANGUAGE SQL STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
  SELECT jsonb_build_object(
    'next_index', (SELECT next_index FROM wb_gateway_probe.counter WHERE singleton),
    'requests', (SELECT count(*) FROM wb_gateway_probe.requests),
    'role', auth.role()
  );
$$;
REVOKE ALL ON FUNCTION public.wb_gateway_probe_assign(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wb_gateway_probe_state() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wb_gateway_probe_assign(TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.wb_gateway_probe_state() TO service_role;
