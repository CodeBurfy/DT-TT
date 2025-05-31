CREATE OR REPLACE FUNCTION sync_auth_users() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO users (firebase_uid, email, role)
    VALUES (NEW.id, NEW.email, 'user')
    ON CONFLICT (firebase_uid) DO UPDATE 
    SET email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_auth_users
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION sync_auth_users();