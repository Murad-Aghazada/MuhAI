--
-- PostgreSQL database dump
--

\restrict OgizocKxI6nfM0Qfh8mSOWguECIKSTWtuj2aaNlTuj2aitSZczeVwpJzhiLFUlu

-- Dumped from database version 15.18 (Debian 15.18-1.pgdg13+1)
-- Dumped by pg_dump version 15.18 (Debian 15.18-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.vendor_categories DROP CONSTRAINT IF EXISTS vendor_categories_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.tax_obligations DROP CONSTRAINT IF EXISTS tax_obligations_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.muhai_scores DROP CONSTRAINT IF EXISTS muhai_scores_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS employees_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.compliance_alerts DROP CONSTRAINT IF EXISTS compliance_alerts_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_user_id_fkey;
DROP INDEX IF EXISTS public.ix_vendor_categories_user_id;
DROP INDEX IF EXISTS public.ix_users_email;
DROP INDEX IF EXISTS public.ix_transactions_user_id;
DROP INDEX IF EXISTS public.ix_transactions_date;
DROP INDEX IF EXISTS public.ix_tax_obligations_user_id;
DROP INDEX IF EXISTS public.ix_tax_obligations_due_date;
DROP INDEX IF EXISTS public.ix_products_user_id;
DROP INDEX IF EXISTS public.ix_muhai_scores_user_id;
DROP INDEX IF EXISTS public.ix_muhai_scores_date;
DROP INDEX IF EXISTS public.ix_invoices_user_id;
DROP INDEX IF EXISTS public.ix_inventory_movements_user_id;
DROP INDEX IF EXISTS public.ix_inventory_movements_product_id;
DROP INDEX IF EXISTS public.ix_inventory_movements_date;
DROP INDEX IF EXISTS public.ix_employees_user_id;
DROP INDEX IF EXISTS public.ix_compliance_alerts_user_id;
DROP INDEX IF EXISTS public.ix_bank_transactions_user_id;
DROP INDEX IF EXISTS public.ix_bank_transactions_date;
ALTER TABLE IF EXISTS ONLY public.vendor_categories DROP CONSTRAINT IF EXISTS vendor_categories_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.vendor_categories DROP CONSTRAINT IF EXISTS uq_vendor_category;
ALTER TABLE IF EXISTS ONLY public.tax_obligations DROP CONSTRAINT IF EXISTS uq_tax_obligation_period;
ALTER TABLE IF EXISTS ONLY public.muhai_scores DROP CONSTRAINT IF EXISTS uq_muhai_scores_user_date;
ALTER TABLE IF EXISTS ONLY public.transactions DROP CONSTRAINT IF EXISTS transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.tax_obligations DROP CONSTRAINT IF EXISTS tax_obligations_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.muhai_scores DROP CONSTRAINT IF EXISTS muhai_scores_pkey;
ALTER TABLE IF EXISTS ONLY public.invoices DROP CONSTRAINT IF EXISTS invoices_pkey;
ALTER TABLE IF EXISTS ONLY public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.employees DROP CONSTRAINT IF EXISTS employees_pkey;
ALTER TABLE IF EXISTS ONLY public.compliance_alerts DROP CONSTRAINT IF EXISTS compliance_alerts_pkey;
ALTER TABLE IF EXISTS ONLY public.bank_transactions DROP CONSTRAINT IF EXISTS bank_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.alembic_version DROP CONSTRAINT IF EXISTS alembic_version_pkc;
DROP TABLE IF EXISTS public.vendor_categories;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.transactions;
DROP TABLE IF EXISTS public.tax_obligations;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.muhai_scores;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.inventory_movements;
DROP TABLE IF EXISTS public.employees;
DROP TABLE IF EXISTS public.compliance_alerts;
DROP TABLE IF EXISTS public.bank_transactions;
DROP TABLE IF EXISTS public.alembic_version;
DROP TYPE IF EXISTS public.transaction_type;
DROP TYPE IF EXISTS public.movement_type;
DROP TYPE IF EXISTS public.invoice_status;
--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: muhai
--

CREATE TYPE public.invoice_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE public.invoice_status OWNER TO muhai;

--
-- Name: movement_type; Type: TYPE; Schema: public; Owner: muhai
--

CREATE TYPE public.movement_type AS ENUM (
    'purchase',
    'sale',
    'adjustment'
);


ALTER TYPE public.movement_type OWNER TO muhai;

--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: muhai
--

CREATE TYPE public.transaction_type AS ENUM (
    'income',
    'expense'
);


ALTER TYPE public.transaction_type OWNER TO muhai;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alembic_version; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.alembic_version (
    version_num character varying(32) NOT NULL
);


ALTER TABLE public.alembic_version OWNER TO muhai;

--
-- Name: bank_transactions; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.bank_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date,
    description character varying,
    amount numeric(14,2) NOT NULL,
    category character varying,
    matched_invoice_id character varying,
    status character varying DEFAULT 'unmatched'::character varying NOT NULL,
    bank_account character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.bank_transactions OWNER TO muhai;

--
-- Name: compliance_alerts; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.compliance_alerts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying NOT NULL,
    severity character varying NOT NULL,
    description text NOT NULL,
    ref_id character varying,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved boolean DEFAULT false NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.compliance_alerts OWNER TO muhai;

--
-- Name: employees; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.employees (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    "position" character varying,
    base_salary numeric(14,2) NOT NULL,
    sgk_rate numeric(5,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tckn character varying,
    start_date date,
    status character varying DEFAULT 'active'::character varying NOT NULL
);


ALTER TABLE public.employees OWNER TO muhai;

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.inventory_movements (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    product_id uuid NOT NULL,
    type public.movement_type NOT NULL,
    quantity numeric(14,3) NOT NULL,
    invoice_id character varying,
    date date DEFAULT now() NOT NULL,
    notes character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_movements OWNER TO muhai;

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.invoices (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    invoice_number character varying,
    vendor_name character varying,
    amount numeric(14,2),
    vat_amount numeric(14,2),
    date date,
    status public.invoice_status DEFAULT 'pending'::public.invoice_status NOT NULL,
    ocr_raw_text text,
    file_url character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.invoices OWNER TO muhai;

--
-- Name: muhai_scores; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.muhai_scores (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    total_score integer NOT NULL,
    tax_compliance numeric(5,4),
    sgk_compliance numeric(5,4),
    cash_flow numeric(5,4),
    debt numeric(5,4),
    invoice_collection numeric(5,4),
    inventory numeric(5,4),
    payroll_sustainability numeric(5,4),
    profitability numeric(5,4),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.muhai_scores OWNER TO muhai;

--
-- Name: products; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    name character varying NOT NULL,
    sku character varying,
    quantity integer,
    unit_cost numeric(14,2),
    low_stock_threshold integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO muhai;

--
-- Name: tax_obligations; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.tax_obligations (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type character varying NOT NULL,
    name character varying NOT NULL,
    period character varying NOT NULL,
    due_date date NOT NULL,
    estimated_amount numeric(14,2),
    paid_amount numeric(14,2),
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    paid_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tax_obligations OWNER TO muhai;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    type public.transaction_type NOT NULL,
    amount numeric(14,2) NOT NULL,
    category character varying,
    description character varying,
    date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transactions OWNER TO muhai;

--
-- Name: users; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying NOT NULL,
    business_name character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO muhai;

--
-- Name: vendor_categories; Type: TABLE; Schema: public; Owner: muhai
--

CREATE TABLE public.vendor_categories (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    vendor_key character varying NOT NULL,
    category character varying NOT NULL,
    corrected boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.vendor_categories OWNER TO muhai;

--
-- Data for Name: alembic_version; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.alembic_version (version_num) FROM stdin;
0008_vendor_categories
\.


--
-- Data for Name: bank_transactions; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.bank_transactions (id, user_id, date, description, amount, category, matched_invoice_id, status, bank_account, created_at) FROM stdin;
\.


--
-- Data for Name: compliance_alerts; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.compliance_alerts (id, user_id, type, severity, description, ref_id, detected_at, resolved, resolved_at, created_at) FROM stdin;
c0140472-8e04-4904-8152-ed4b7d6e5ad0	bff566df-02fd-498d-85f0-0575ca85fcb3	suspicious_invoice	medium	KDV tutarı geçerli bir orana (%1/%10/%20) uymuyor.	5f28efbb-e974-43f0-8404-84e6682b4c1e	2026-06-18 20:15:10.075607+00	t	2026-06-18 20:15:19.998268+00	2026-06-18 20:15:10.075607+00
7cc1bc87-69a7-4ce3-84c8-ec1c7c2b47e1	bff566df-02fd-498d-85f0-0575ca85fcb3	suspicious_invoice	medium	KDV tutarı geçerli bir orana (%1/%10/%20) uymuyor.	5f28efbb-e974-43f0-8404-84e6682b4c1e	2026-06-18 20:15:20.174139+00	t	2026-06-18 20:15:22.475563+00	2026-06-18 20:15:20.174139+00
b5cd5349-3997-455a-ac61-66b28561e35a	bff566df-02fd-498d-85f0-0575ca85fcb3	suspicious_invoice	medium	KDV tutarı geçerli bir orana (%1/%10/%20) uymuyor.	5f28efbb-e974-43f0-8404-84e6682b4c1e	2026-06-18 20:15:22.638211+00	t	2026-06-18 20:15:23.195392+00	2026-06-18 20:15:22.638211+00
16c734ab-90bc-4f6f-be04-3f40d480758e	bff566df-02fd-498d-85f0-0575ca85fcb3	suspicious_invoice	medium	KDV tutarı geçerli bir orana (%1/%10/%20) uymuyor.	5f28efbb-e974-43f0-8404-84e6682b4c1e	2026-06-18 20:15:25.036164+00	f	\N	2026-06-18 20:15:25.036164+00
88c9ec97-f3a7-41a0-a8e9-32f798625834	bff566df-02fd-498d-85f0-0575ca85fcb3	suspicious_invoice	medium	KDV tutarı geçerli bir orana (%1/%10/%20) uymuyor.	5f28efbb-e974-43f0-8404-84e6682b4c1e	2026-06-18 20:15:23.359345+00	t	2026-06-18 20:15:25.290085+00	2026-06-18 20:15:23.359345+00
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.employees (id, user_id, name, "position", base_salary, sgk_rate, created_at, tckn, start_date, status) FROM stdin;
a54eb557-68b0-4f3d-98a0-aaafee3b252f	bff566df-02fd-498d-85f0-0575ca85fcb3	Ughur	Ceo	500000.00	0.1400	2026-06-18 18:32:43.183695+00	\N	\N	active
e0cc6165-2939-4383-b5df-806e16111979	bff566df-02fd-498d-85f0-0575ca85fcb3	Ee	\N	1551.00	0.1400	2026-06-18 18:58:42.257458+00	\N	\N	active
\.


--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.inventory_movements (id, user_id, product_id, type, quantity, invoice_id, date, notes, created_at) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.invoices (id, user_id, invoice_number, vendor_name, amount, vat_amount, date, status, ocr_raw_text, file_url, created_at) FROM stdin;
5f28efbb-e974-43f0-8404-84e6682b4c1e	bff566df-02fd-498d-85f0-0575ca85fcb3	108729	Ughur	15000.00	1500.00	2026-06-18	approved	\N	\N	2026-06-18 18:35:15.281706+00
\.


--
-- Data for Name: muhai_scores; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.muhai_scores (id, user_id, date, total_score, tax_compliance, sgk_compliance, cash_flow, debt, invoice_collection, inventory, payroll_sustainability, profitability, created_at) FROM stdin;
e46c3fcd-20ef-4897-903a-b1ec8aed732a	bff566df-02fd-498d-85f0-0575ca85fcb3	2026-06-18	77	1.0000	1.0000	0.3333	1.0000	1.0000	0.5000	0.3282	1.0000	2026-06-18 18:31:42.38199+00
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.products (id, user_id, name, sku, quantity, unit_cost, low_stock_threshold, created_at) FROM stdin;
b7464f03-7980-48f3-aba3-41384c49188a	bff566df-02fd-498d-85f0-0575ca85fcb3	Elma	10g	1000	15.00	100	2026-06-18 18:33:07.602956+00
a03c55d1-9d00-4499-8f8e-6b005bc342ab	bff566df-02fd-498d-85f0-0575ca85fcb3	Banan	\N	10	500.00	100	2026-06-18 18:34:36.232101+00
\.


--
-- Data for Name: tax_obligations; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.tax_obligations (id, user_id, type, name, period, due_date, estimated_amount, paid_amount, status, paid_date, created_at) FROM stdin;
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.transactions (id, user_id, type, amount, category, description, date, created_at) FROM stdin;
ef6dc6f0-a8a4-40da-bcc3-d3a52c2e0f77	bff566df-02fd-498d-85f0-0575ca85fcb3	income	999999.00	Hh	Bb	2026-06-18	2026-06-18 18:36:26.840122+00
d6056eeb-1414-4346-8407-060d0c7cf317	bff566df-02fd-498d-85f0-0575ca85fcb3	expense	500000.00	Maas	\N	2026-06-18	2026-06-18 18:36:41.327318+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.users (id, email, hashed_password, business_name, created_at) FROM stdin;
bff566df-02fd-498d-85f0-0575ca85fcb3	test@test.com	$2b$12$BNjYWj38cVHY7TSlRhsJcO6tSGMGN/USe5fwecm4RPMlZltkyF2Dm	Yilmaz Ticaret	2026-06-18 18:31:41.524704+00
\.


--
-- Data for Name: vendor_categories; Type: TABLE DATA; Schema: public; Owner: muhai
--

COPY public.vendor_categories (id, user_id, vendor_key, category, corrected, created_at) FROM stdin;
\.


--
-- Name: alembic_version alembic_version_pkc; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.alembic_version
    ADD CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num);


--
-- Name: bank_transactions bank_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_pkey PRIMARY KEY (id);


--
-- Name: compliance_alerts compliance_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: muhai_scores muhai_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.muhai_scores
    ADD CONSTRAINT muhai_scores_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: tax_obligations tax_obligations_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT tax_obligations_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: muhai_scores uq_muhai_scores_user_date; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.muhai_scores
    ADD CONSTRAINT uq_muhai_scores_user_date UNIQUE (user_id, date);


--
-- Name: tax_obligations uq_tax_obligation_period; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT uq_tax_obligation_period UNIQUE (user_id, type, period);


--
-- Name: vendor_categories uq_vendor_category; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.vendor_categories
    ADD CONSTRAINT uq_vendor_category UNIQUE (user_id, vendor_key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vendor_categories vendor_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.vendor_categories
    ADD CONSTRAINT vendor_categories_pkey PRIMARY KEY (id);


--
-- Name: ix_bank_transactions_date; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_bank_transactions_date ON public.bank_transactions USING btree (date);


--
-- Name: ix_bank_transactions_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_bank_transactions_user_id ON public.bank_transactions USING btree (user_id);


--
-- Name: ix_compliance_alerts_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_compliance_alerts_user_id ON public.compliance_alerts USING btree (user_id);


--
-- Name: ix_employees_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: ix_inventory_movements_date; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_inventory_movements_date ON public.inventory_movements USING btree (date);


--
-- Name: ix_inventory_movements_product_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_inventory_movements_product_id ON public.inventory_movements USING btree (product_id);


--
-- Name: ix_inventory_movements_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_inventory_movements_user_id ON public.inventory_movements USING btree (user_id);


--
-- Name: ix_invoices_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_invoices_user_id ON public.invoices USING btree (user_id);


--
-- Name: ix_muhai_scores_date; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_muhai_scores_date ON public.muhai_scores USING btree (date);


--
-- Name: ix_muhai_scores_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_muhai_scores_user_id ON public.muhai_scores USING btree (user_id);


--
-- Name: ix_products_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_products_user_id ON public.products USING btree (user_id);


--
-- Name: ix_tax_obligations_due_date; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_tax_obligations_due_date ON public.tax_obligations USING btree (due_date);


--
-- Name: ix_tax_obligations_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_tax_obligations_user_id ON public.tax_obligations USING btree (user_id);


--
-- Name: ix_transactions_date; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_transactions_date ON public.transactions USING btree (date);


--
-- Name: ix_transactions_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_transactions_user_id ON public.transactions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: muhai
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_vendor_categories_user_id; Type: INDEX; Schema: public; Owner: muhai
--

CREATE INDEX ix_vendor_categories_user_id ON public.vendor_categories USING btree (user_id);


--
-- Name: bank_transactions bank_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.bank_transactions
    ADD CONSTRAINT bank_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: compliance_alerts compliance_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.compliance_alerts
    ADD CONSTRAINT compliance_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: employees employees_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: inventory_movements inventory_movements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: muhai_scores muhai_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.muhai_scores
    ADD CONSTRAINT muhai_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: products products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tax_obligations tax_obligations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.tax_obligations
    ADD CONSTRAINT tax_obligations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vendor_categories vendor_categories_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: muhai
--

ALTER TABLE ONLY public.vendor_categories
    ADD CONSTRAINT vendor_categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict OgizocKxI6nfM0Qfh8mSOWguECIKSTWtuj2aaNlTuj2aitSZczeVwpJzhiLFUlu

