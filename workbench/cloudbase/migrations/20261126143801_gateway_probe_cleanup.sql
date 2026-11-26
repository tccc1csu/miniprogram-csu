-- Remove only the disposable objects introduced by 20261126143800.
DROP FUNCTION public.wb_gateway_probe_assign(TEXT, BOOLEAN);
DROP FUNCTION public.wb_gateway_probe_state();
DROP TABLE wb_gateway_probe.requests;
DROP TABLE wb_gateway_probe.counter;
DROP SCHEMA wb_gateway_probe;
