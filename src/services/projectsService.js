// services/projectService.js
const Project = require("../models/Project");
const mongoose = require("mongoose");
exports.createProject = async (projectData) => {
  const project = new Project(projectData);
  return await project.save();
};

exports.updateProject = async (projectId, projectData) => {
  return await Project.findByIdAndUpdate(projectId, projectData, { new: true });
};

exports.deleteProject = async (projectId) => {
  const result = await Project.findByIdAndDelete(projectId);
  return result ? true : false;
};

// New service method to get all projects
exports.getAllProjects = async () => {
  return await Project.find().populate("template"); // Return all projects, no filter
};
/* 
exports.getDistinctLabelsInProject = async (projectId) => {
  try {
    const labels = await Project.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(projectId) } },
      {
        $lookup: {
          from: "templates",
          localField: "_id",
          foreignField: "projectId",
          as: "templates",
        },
      },
      { $unwind: "$templates" },
      {
        $lookup: {
          from: "highlights",
          localField: "templates.highlights",
          foreignField: "_id",
          as: "highlights",
        },
      },
      { $unwind: "$highlights" },
      {
        $group: { _id: "$highlights.label" }, // Group by the label to ensure distinct values
      },
      { $project: { label: "$_id", _id: 0 } },
    ]);

    if (!labels || labels.length === 0) {
      return []; // Return an empty array if no labels are found
    }

    return labels.map((item) => item.label); // Extract labels into a flat array
  } catch (error) {
    console.log(error);
    throw new Error(`Failed to retrieve highlights: ${error.message}`);
  }
}; */
exports.getDistinctLabelsInProject = async (projectId) => {
  try {
    // Define the default structure for all highlight types
    const defaultHighlightTypes = ["text", "table", "image"];
    const defaultResult = defaultHighlightTypes.map((type) => ({
      highlightType: type,
      labels: [],
    }));

    const labelsGroupedByType = await Project.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(projectId) } },
      {
        $lookup: {
          from: "templates",
          localField: "_id",
          foreignField: "projectId",
          as: "templates",
        },
      },
      { $unwind: "$templates" },
      {
        $lookup: {
          from: "highlights",
          localField: "templates.highlights",
          foreignField: "_id",
          as: "highlights",
        },
      },
      { $unwind: "$highlights" },
      {
        $group: {
          _id: "$highlights.type", // Group by highlightType
          labels: { $addToSet: "$highlights.label" }, // Collect distinct labels
        },
      },
      {
        $project: {
          highlightType: "$_id",
          labels: 1,
          _id: 0,
        },
      },
    ]);
    // Merge the query result with the default structure
    const finalResult = defaultResult.map((defaultType) => {
      const found = labelsGroupedByType.find(
        (group) => group.highlightType === defaultType.highlightType
      );
      return found || defaultType;
    });

    return finalResult;

    // return labelsGroupedByType; // Return labels grouped by type
  } catch (error) {
    console.log(error);
    throw new Error(
      `Failed to retrieve labels grouped by highlightType: ${error.message}`
    );
  }
};

exports.getTemplatesWithHighlights = async (projectId) => {
  try {
    const templatesWithHighlights = await Project.aggregate([
      // Match the specific project by ID
      { $match: { _id: new mongoose.Types.ObjectId(projectId) } },

      // Lookup templates related to the project
      {
        $lookup: {
          from: "templates",
          localField: "_id",
          foreignField: "projectId",
          as: "templates",
        },
      },

      // Unwind templates array to work on individual templates
      { $unwind: "$templates" },

      // Lookup highlights related to each template
      {
        $lookup: {
          from: "highlights",
          localField: "templates.highlights",
          foreignField: "_id",
          as: "templates.highlights",
        },
      },
      /*  {
        $addFields: {
          "templates.highlights": {
            $filter: {
              input: "$templates.highlights",
              as: "highlight",
              cond: { $eq: ["$$highlight.type", "text"] },
            },
          },
        },
      }, */

      // Project to include only the necessary fields for each template
      {
        $project: {
          "templates._id": 1, // Include template id
          "templates.fileName": 1, // Include template name
          "templates.highlights": 1, // Include highlights array
        },
      },

      // Group back templates into a single array for the project
      {
        $group: {
          _id: "$_id", // Group by the project ID
          templates: { $push: "$templates" }, // Collect the templates with highlights
        },
      },

      // Project the final output format
      {
        $project: {
          _id: 0, // Exclude the project ID from the final output
          templates: 1, // Include only the templates array
        },
      },
    ]);

    // If no templates are found, return an empty array
    if (!templatesWithHighlights || templatesWithHighlights.length === 0) {
      return [];
    }

    // Return the templates array (first item in the result since there's only one project)
    return templatesWithHighlights[0].templates;
  } catch (error) {
    console.error(error);
    throw new Error(
      `Failed to retrieve templates with highlights: ${error.message}`
    );
  }
};
