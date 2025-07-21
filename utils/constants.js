const entitiesList = [
    'DISTRICT',
    'AVATAR',
    'SUBJECT',
    'HOSPITAL'
];

const activityTypes = ['LOGGED_IN', 'LOGGED_OUT', 'CREATED', 'MODIFIED', 'ACTIVATED', 'DEACTIVATED', 'ARCHIVED'];

const childActivityTypes = ['RECEIVED', 'SENT_BACK', 'PROCESSED', 'APPROVED', 'REJECTED', 'ON_HOLD'];

const fileUnits = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

const maxFileSelection = 10;

const fileTypeLimits = {
    image: 5,
    audio: 10,
    video: 50,
    document: 25
}

const allowedFileTypes = [
    {
        type: "image",
        mimetype: "image/gif",
        extension: [".gif"],
        max_upload_size: fileTypeLimits.image
    },
    {
        type: "image",
        mimetype: "image/jpeg",
        extension: [".jpg", ".jpeg"],
        max_upload_size: fileTypeLimits.image
    }, 
    {
        type: "image",
        mimetype: "image/png",
        extension: [".png"],
        max_upload_size: fileTypeLimits.image
    }, 
    {
        type: "image",
        mimetype: "image/webp",
        extension: [".webp"],
        max_upload_size: fileTypeLimits.image
    }, 
    {
        type: "audio",
        mimetype: "audio/wave",
        extension: [".wav"],
        max_upload_size: fileTypeLimits.audio
    },
    {
        type: "audio",
        mimetype: "audio/wav",
        extension: [".wav"],
        max_upload_size: fileTypeLimits.audio
    },
    {
        type: "audio",
        mimetype: "audio/x-wav",
        extension: [".xwav"],
        max_upload_size: fileTypeLimits.audio
    },
    {
        type: "audio",
        mimetype: "audio/mpeg",
        extension: [".mp3"],
        max_upload_size: fileTypeLimits.audio
    }, 
    {
        type: "video",
        mimetype: "video/mp4",
        extension: [".mp4"],
        max_upload_size: fileTypeLimits.video
    }, 
    {
        type: "video",
        mimetype: "video/x-m4v",
        extension: [".m4v"],
        max_upload_size: fileTypeLimits.video
    },
    {
        type: "video",
        mimetype: "video/quicktime",
        extension: [".mov"],
        max_upload_size: fileTypeLimits.video
    },
    {
        type: "video",
        mimetype: "video/webm",
        extension: [".webm"],
        max_upload_size: fileTypeLimits.video
    },
    {
        type: "video",
        mimetype: "video/x-msvideo",
        extension: [".avi"],
        max_upload_size: fileTypeLimits.video
    },
    {
        type: "video",
        mimetype: "video/mpeg",
        extension: [".mpeg"],
        max_upload_size: fileTypeLimits.video
    },
    {
        type: "document",
        mimetype: "application/pdf",
        extension: [".pdf"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "text/csv",
        extension: [".csv"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/msword",
        extension: [".doc"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        extension: [".docx"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "vnd.ms-powerpoint",
        extension: [".ppt", ".pps"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        extension: [".pptx"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
        extension: [".ppsx"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/vnd.ms-excel",
        extension: [".xls"],
        max_upload_size: fileTypeLimits.document
    },
    {
        type: "document",
        mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        extension: [".xlsx"],
        max_upload_size: fileTypeLimits.document
    },
];





module.exports = {
    entitiesList,
    activityTypes,
    childActivityTypes,
    allowedFileTypes,
    fileUnits,
    maxFileSelection,
    
}