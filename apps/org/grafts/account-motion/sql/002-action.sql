-- What a passed motion carries into the books once it admits or excludes
-- a member, each citing it: the subscription, the withdrawal and the
-- freeze settle only once the motion closed and passed.
SELECT motion.register_cite('account:capital:subscribe', 'admit-member', 'account-motion');
SELECT motion.register_cite('account:capital:withdraw', 'exclude-member', 'account-motion');
SELECT motion.register_cite('account:account:freeze', 'exclude-member', 'account-motion');
