select cron.unschedule('dispatch-reminders-every-minute');
select cron.schedule(
  'dispatch-reminders-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--9b50dee3-3ce3-4a3f-ab93-f56e4cefd9c1.lovable.app/api/public/hooks/dispatch-reminders',
    headers := '{"Content-Type": "application/json", "x-cron-secret": "806838f219d6cfbffb60267932f60da760b47a5bfbfa48aeee460b219aa01144"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);