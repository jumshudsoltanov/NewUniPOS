const TagsModel = require("../model/TagsModel");

const getTagsList = async (req, res) => {
  const { profileId } = req.params;
  try {
    const tags = await TagsModel.findAll({ where: { profile_id: profileId } });
    if (tags.length === 0) {
      return res.status(200).json({ message: "false", data: "tags not found" });
    }
    res.status(200).json({ message: "success", data: tags });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = { getTagsList };
