-- A device is named by its key and its holder's address, a pseudonym; its
-- label names the device (laptop, phone), never a person.
COMMENT ON COLUMN key.device.address IS 'not personal: the holder''s pseudonymous address';
