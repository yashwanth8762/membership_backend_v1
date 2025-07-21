const SUCCESS = 200;                                                   // ALL WELL
const CREATED = 201;                                                   // CREATED NEW ENTRY
const ACCEPTED = 202;                                                  // ACCEPTED BUT HAS SOME WARNING
const NOT_FOUND = 204;                                                 // NO RESOURCE FOUND FOR THE REQUEST
const BAD_REQUEST = 400;                                               // SYNTAX ISSUES or BAD CODING
const UNAUTHORISED = 401;                                              // NOT AUTHORISED 
const FORBIDDEN = 403;                                                 // AUTHORISED BUT BLOCKED DUE TO CERTAIN CONDITIONS
const TIME_OUT = 408;                                                  // REQUEST TIME OUT
const UNSUPPORTED_MEDIA = 415;                                         // MEDIA TYPE NOT SUPPORTED
const VALIDATION_FAILED = 422;                                         // DOES NOT MINIMUM CRITERIA TO PROCESS THE REQUEST
const INTERNAL_SERVER_ERROR = 500
module.exports = {
    SUCCESS,
    CREATED,
    ACCEPTED,
    NOT_FOUND,
    BAD_REQUEST,
    UNAUTHORISED,
    FORBIDDEN,
    TIME_OUT,
    UNSUPPORTED_MEDIA,
    VALIDATION_FAILED,
    INTERNAL_SERVER_ERROR
}