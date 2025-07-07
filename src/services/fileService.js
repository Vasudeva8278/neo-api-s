const mammoth = require("mammoth");
const pdf = require("pdf-parse");
const HTMLtoDOCX = require("html-to-docx");
const juice = require("juice");
const postcss = require("postcss");
const postcssPresetEnv = require("postcss-preset-env");
const cheerio = require("cheerio");
const postcssShorthand = require("postcss-short");
const AWS = require("aws-sdk");
const fs = require("fs");
const options = {
  secretAccessKey: process.env.AWS_SECRET_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY,
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_BUCKET_END_POINT
};
/* const options = {
  accessKeyId:'AKIAZI2LD22B7WTMEIFP',
  secretAccessKey: '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',
  region: 'ap-south-1',
  endpoint: 'https://neo-storage.s3.ap-south-1.amazonaws.com',
  correctClockSkew: true,
}; */

exports.extractText = async (fileBuffer, extension) => {
  if (extension.match(/pdf/i)) {
    const data = await pdf(fileBuffer);
    return data.text;
  } else if (extension.match(/(docx|doc)/i)) {
    return new Promise((resolve, reject) => {
      mammoth
        .convertToHtml(
          { buffer: fileBuffer },
          {
            styleMap: [
              "p[style-name='Title'] => h1:fresh",
              "p[style-name='Subtitle'] => h2:fresh",
            ],
          }
        )
        .then((result) => {
          resolve(result.value);
        })
        .catch((error) => {
          reject(error);
        });
    });
  } else {
    throw new Error("Unsupported file type");
  }
};

exports.convertHTMLToDocxBuffer = async (htmlString) => {
  try {
    htmlString = await convertInlineStyles(htmlString);

    // Check if there's a footer element
    const $ = cheerio.load(htmlString);
    const footerElement = $("footer");
    let footerHtmlString = "";
    if (footerElement.length) {
      // Get the inner HTML of the footer element
      footerHtmlString = footerElement.html();
      footerElement.remove();
    }
    // Get the modified HTML string without the footer
    htmlString = $.html();

    //console.log(htmlString)
    const fileBuffer = await HTMLtoDOCX(
      htmlString,
      null,
      {
        table: { row: { cantSplit: true } },
        footer: true,
        pageNumber: true,
      },
      footerHtmlString
    );
    return fileBuffer;
  } catch (error) {
    console.error("Error converting CSS to shorthand:", error);
    throw error;
  }
};

function convertToShorthand(style) {
  let shorthandStyle = style;

  // Object to keep track of border components
  const borderComponents = {
    width: null,
    style: null,
    color: null,
  };

  // Track border components
  shorthandStyle = shorthandStyle.replace(
    /border-(width|style|color):\s*([^;]+);?/g,
    (match, type, value) => {
      borderComponents[type] = value;
      return "";
    }
  );

  // Combine border components into shorthand property
  if (
    borderComponents.width ||
    borderComponents.style ||
    borderComponents.color
  ) {
    let borderValue = "";
    if (borderComponents.width) borderValue += `${borderComponents.width} `;
    if (borderComponents.style) borderValue += `${borderComponents.style} `;
    if (borderComponents.color) borderValue += `${borderComponents.color}`;

    shorthandStyle += `border: ${borderValue};`;
  }

  // Convert margin
  shorthandStyle = shorthandStyle
    .replace(
      /margin-(top|right|bottom|left):\s*([^;]+);?/g,
      (match, side, value) => {
        return "";
      }
    )
    .replace(/margin:\s*([^;]+);?/g, (match, values) => {
      const valuesArray = values.split(/\s+/);
      if (valuesArray.length === 1) return `margin: ${valuesArray[0]};`;
      if (valuesArray.length === 2)
        return `margin: ${valuesArray[0]} ${valuesArray[1]};`;
      if (valuesArray.length === 3)
        return `margin: ${valuesArray[0]} ${valuesArray[1]} ${valuesArray[2]};`;
      if (valuesArray.length === 4)
        return `margin: ${valuesArray[0]} ${valuesArray[1]} ${valuesArray[2]} ${valuesArray[3]};`;
      return match;
    });

  // Convert padding
  shorthandStyle = shorthandStyle
    .replace(
      /padding-(top|right|bottom|left):\s*([^;]+);?/g,
      (match, side, value) => {
        return "";
      }
    )
    .replace(/padding:\s*([^;]+);?/g, (match, values) => {
      const valuesArray = values.split(/\s+/);
      if (valuesArray.length === 1) return `padding: ${valuesArray[0]};`;
      if (valuesArray.length === 2)
        return `padding: ${valuesArray[0]} ${valuesArray[1]};`;
      if (valuesArray.length === 3)
        return `padding: ${valuesArray[0]} ${valuesArray[1]} ${valuesArray[2]};`;
      if (valuesArray.length === 4)
        return `padding: ${valuesArray[0]} ${valuesArray[1]} ${valuesArray[2]} ${valuesArray[3]};`;
      return match;
    });
  // console.log(shorthandStyle);
  return shorthandStyle;
}

async function convertInlineStyles(html) {
  const $ = cheerio.load(html);
  const elementsWithStyle = $("[style]");

  for (let i = 0; i < elementsWithStyle.length; i++) {
    const element = elementsWithStyle[i];
    const originalStyle = $(element).attr("style");
    if (originalStyle) {
      try {
        const shorthandStyle = await convertToShorthand(originalStyle);
        $(element).attr("style", shorthandStyle);
      } catch (error) {
        console.error(
          `Error converting style for element at index ${i}:`,
          error
        );
      }
    }
  }
  // replace all font tags to p styles.
  $("font").replaceWith(function () {
    var face = $(this).attr("face") || "inherit"; // Get the face attribute or use 'inherit' if not set
    var color = $(this).attr("color") || "inherit"; // Get the color attribute or use 'inherit' if not set
    var size = $(this).attr("size") || "3"; // Get the size attribute or use '3' (default size) if not set

    // Map font size (1-7) to corresponding pt values
    var sizeMap = {
      1: "8pt",
      2: "10pt",
      3: "12pt",
      4: "14pt",
      5: "18pt",
      6: "24pt",
      7: "36pt",
    };

    var fontSize = sizeMap[size] || "12pt"; // Use the mapped size or default to 12pt

    return $("<span>")
      .css({
        "font-family": face,
        color: color,
        "font-size": fontSize,
      })
      .html($(this).html());
  });

  //Checking table width is in %., if its in %, calculate from parent node's width

  $("table").each(function () {
    const $table = $(this);

    // Get the width of the parent element
    let parentWidth = $table.parent().css("width");

    // If the parent has no width or it's in percentage, use the default width
    if (!parentWidth || parentWidth.includes("%")) {
      parentWidth = $table.parent()?.parent()?.css("width");
      if (!parentWidth || parentWidth.includes("%")) {
        parentWidth = "700px";
      }
    }

    const parentWidthPx = parseFloat(parentWidth);

    // Proceed with conversion only if the table's width is in percentage
    const tableWidth = $table.attr("width") || $table.css("width");
    if (tableWidth && tableWidth.includes("%")) {
      convertWidth($table, parentWidthPx);
      console.log("Table width", tableWidth, "Parent width", parentWidth);

      $table.find("tr").each(function () {
        const $tr = $(this);
        const trWidth = $tr.attr("width") || $tr.css("width");

        if (trWidth && trWidth.includes("%")) {
          console.log("TR width", trWidth);
          convertWidth($tr, parentWidthPx);

          $tr.find("td").each(function () {
            const $td = $(this);
            let tdWidth = $td.attr("width") || $td.css("width");

            if (tdWidth && tdWidth.includes("%")) {
              // Check if the table has a width in pixels
              let effectiveWidth = $table.css("width");
              if (!effectiveWidth || effectiveWidth.includes("%")) {
                // Go to the parent of the table
                effectiveWidth = $table.parent()?.css("width");
                if (!effectiveWidth || effectiveWidth.includes("%")) {
                  // If still not found, use the default width
                  effectiveWidth = "700px";
                }
              }

              const effectiveWidthPx = parseFloat(effectiveWidth);
              convertWidth($td, effectiveWidthPx);
              console.log(
                "TD width",
                tdWidth,
                "Effective width",
                effectiveWidth
              );
            }
          });
        }
      });

      // Additional check directly for `td` elements if not already processed in `tr`
      $table.find("td").each(function () {
        const $td = $(this);
        let tdWidth = $td.attr("width") || $td.css("width");

        if (tdWidth && tdWidth.includes("%")) {
          // Check if the table has a width in pixels
          let effectiveWidth = $table.css("width");
          if (!effectiveWidth || effectiveWidth.includes("%")) {
            // Go to the parent of the table
            effectiveWidth = $table.parent()?.css("width");
            if (!effectiveWidth || effectiveWidth.includes("%")) {
              // If still not found, use the default width
              effectiveWidth = "700px";
            }
          }

          const effectiveWidthPx = parseFloat(effectiveWidth);
          convertWidth($td, effectiveWidthPx);
          console.log("TD width", tdWidth, "Effective width", effectiveWidth);
        }
      });
    }
  });
  function convertWidth($element, parentWidthPx) {
    const width = $element.attr("width") || $element.css("width");
    //  console.log("converting")
    if (width && width.includes("%")) {
      const percentage = parseFloat(width);
      const newWidth = (percentage / 100) * parentWidthPx;
      $element.css("width", `${newWidth}px`);
    }
  }

  $("table, tr, td").each(function () {
    // Get the width attribute or inline style
    const width = $(this).attr("width") || $(this).css("width");

    // Check if the width is specified in percentages
    if (width && width.includes("auto")) {
      // Remove the width attribute
      $(this).removeAttr("width");

      // Alternatively, you could also remove inline style width
      $(this).css("width", "");
    }
  });

  $("td").each(function () {
    if ($(this).css("display") === "none") {
      $(this).remove();
    }
  });

  return $.html();
}

// Helper function to convert percentage to pixels
function convertWidth(element, parentWidthPx) {
  // Match width percentage in the style attribute
  const widthStyle = element.attr("style")?.match(/width:\s*([\d.]+)%/);

  if (widthStyle) {
    // Convert the width percentage to a float
    const widthPercent = parseFloat(widthStyle[1]);
    console.log(widthPercent);

    // Calculate the width in pixels based on the parent width
    const elementWidthPx = (widthPercent / 100) * parentWidthPx;
    console.log(elementWidthPx);
    // Replace the width percentage with the calculated pixel width in the style
    const newStyle = element
      .attr("style")
      .replace(/width:\s*[\d.]+%/, `width: ${elementWidthPx}px`);
    element.attr("style", newStyle);
  }
}

exports.uploadDocxToS3 = async (fileType, file, fileBuffer, folder) => {
  // console.log(fileType,":::",file,":::", fileBuffer,":::",folder);
  try {
    AWS.config.update(options);
    const s3 = new AWS.S3({
      s3ForcePathStyle: true,
    });
    let fileName;
    let buffer;
    let contentType;

    if (fileType === "Template") {
      fileName = file.originalname;
      buffer = file.buffer;
      contentType = file.mimetype;
    }
    if (fileType === "Document") {
      fileName = file;
      buffer = fileBuffer;
      contentType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }

    const params = {
      Bucket: folder, // The bucket name
      Key: `${fileName}`, // The file name (can include a path)
      Body: buffer, // The file data (in buffer form)
      ContentType: contentType, // The file MIME type
      // ACL: 'public-read'            // (Optional) Set the file to be publicly accessible
    };

    return s3.upload(params).promise(); // Returns a promise
    //return null;
  } catch (err) {
    console.log("error while uploading file to AWS S3 bucket", err);
    throw err;
  }
};

/**
 * Uploads a file to AWS S3 and returns the file URL.
 * @param {Buffer} fileBuffer - The file buffer to upload.
 * @param {string} fileName - The name/key for the file in S3.
 * @param {string} mimeType - The MIME type of the file.
 * @returns {Promise<string>} - The URL of the uploaded file.
 */
const uploadToS3 = async (fileBuffer, fileName, mimeType) => {
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY1,
    secretAccessKey: process.env.AWS_SECRET_KEY1,
    region: process.env.AWS_REGION,
  });

  const s3 = new AWS.S3();

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimeType,
    // ACL: "public-read", // Set the file as public
  };

  try {
    console.log("uploading");
    const s3Response = await s3.upload(uploadParams).promise();
    return s3Response.Location; // Return the URL of the uploaded file
  } catch (error) {
    throw new Error(`Error uploading to S3: ${error.message}`);
  }
};

module.exports = { uploadToS3 };
