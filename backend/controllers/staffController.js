const {
  acceptTokenByStaff,
  setServiceDuration,
  completeTokenService,
  getStaffOverview,
} = require('../services/queueService');

const getOverview = async (req, res) => {
  try {
    res.json(await getStaffOverview(req.user._id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: 'Server error' });
  }
};

const acceptToken = async (req, res) => {
  try {
    const token = await acceptTokenByStaff({
      tokenId: req.params.id,
      staffId: req.user._id,
      io: req.app.get('io'),
    });
    res.json(token);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Server error' });
  }
};

const updateServiceDuration = async (req, res) => {
  try {
    const { durationMinutes } = req.body;
    if (!durationMinutes || durationMinutes < 1) {
      return res.status(400).json({ message: 'Duration must be at least 1 minute.' });
    }
    const token = await setServiceDuration({
      tokenId: req.params.id,
      staffId: req.user._id,
      durationMinutes,
      io: req.app.get('io'),
    });
    res.json(token);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Server error' });
  }
};

const completeToken = async (req, res) => {
  try {
    const token = await completeTokenService({
      tokenId: req.params.id,
      staffId: req.user._id,
      io: req.app.get('io'),
    });
    res.json(token);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message || 'Server error' });
  }
};

module.exports = { getOverview, acceptToken, updateServiceDuration, completeToken };
