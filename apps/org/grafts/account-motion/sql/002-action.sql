-- What a passed motion carries into the books once it admits or ends a
-- membership, each citing it: the subscription, the withdrawal and the
-- freeze settle only once the motion closed and passed.
SELECT motion.register_cite('account:capital:subscribe', 'account-motion');
SELECT motion.register_cite('account:capital:withdraw', 'account-motion');
SELECT motion.register_cite('account:account:freeze', 'account-motion');
