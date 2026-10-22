\set ON_ERROR_STOP on
-- Run as the database owner. All arguments are psql-quoted values, never SQL.
-- Existing registrations or existing role names abort the whole setup.
begin;
create temporary table maintenance_setup (
  environment text check (environment in ('test', 'production')),
  host text check (host ~ '^[a-z0-9.-]+$'),
  port integer check (port between 1 and 65535),
  person_one text check (person_one ~ '^[a-z][a-z0-9_]{2,62}$'),
  person_two text check (person_two ~ '^[a-z][a-z0-9_]{2,62}$'),
  check (person_one <> person_two)
) on commit drop;
insert into maintenance_setup values
  (:'environment', :'database_host', :'database_port'::integer, :'maintainer_one', :'maintainer_two');
select format('create role %I nologin', person_one) from maintenance_setup \gexec
select format('create role %I nologin', person_two) from maintenance_setup \gexec
select format('grant pickleball_rating_maintenance to %I, %I', person_one, person_two) from maintenance_setup \gexec
insert into rating_maintenance_target (environment, database_host, database_port, database_name)
  select environment, host, port, current_database() from maintenance_setup;
insert into rating_maintenance_operators (slot, database_role, display_name)
  select 1, person_one::name, person_one from maintenance_setup
  union all select 2, person_two::name, person_two from maintenance_setup;
commit;
\echo 'Registered two NOLOGIN roles. Set each password with psql \password, then explicitly ALTER ROLE ... LOGIN. Do not use Neon Console-created elevated roles.'
