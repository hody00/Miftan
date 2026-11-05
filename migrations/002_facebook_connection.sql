ALTER TABLE crawler_state ADD COLUMN facebook_connected boolean NOT NULL DEFAULT false;
ALTER TABLE crawler_state ADD COLUMN disconnect_requested boolean NOT NULL DEFAULT false;
ALTER TABLE crawler_state ADD COLUMN browser_profile text NOT NULL DEFAULT 'legacy';
