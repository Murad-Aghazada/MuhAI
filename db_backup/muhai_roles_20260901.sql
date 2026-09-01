--
-- PostgreSQL database cluster dump
--

\restrict sn245A2XT95lkuETBsGPsbZ0Pq7FO0AvAYeejPGTEL4Wr8TWSpCquO9KQDggYN6

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

--
-- Roles
--

CREATE ROLE muhai;
ALTER ROLE muhai WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS PASSWORD 'SCRAM-SHA-256$4096:qH8c4MomzltlblrWc4CVIQ==$26Czz/H7W+V7k9TeLG4OfCfQQ3Po1877NFeNtXSp0BU=:P7TNOmLJFej5pItAcHfkV4akT7fNRS8QeI/VEqgWEJY=';

--
-- User Configurations
--






\unrestrict sn245A2XT95lkuETBsGPsbZ0Pq7FO0AvAYeejPGTEL4Wr8TWSpCquO9KQDggYN6

--
-- PostgreSQL database cluster dump complete
--

