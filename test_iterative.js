/* GLOBAL CONSTANTS AND VARIABLES */

/* assignment specific globals */
const WIN_Z = 0;  // default graphics window z coord in world space
const WIN_LEFT = 0; const WIN_RIGHT = 1;  // default left and right x coords in world space
const WIN_BOTTOM = 0; const WIN_TOP = 1;  // default top and bottom y coords in world space
const INPUT_TRIANGLES_URL = "https://ncsucgclass.github.io/prog2/triangles.json"; // triangles file loc
const INPUT_SPHERES_URL = "https://ncsucgclass.github.io/prog2/ellipsoids.json"; // ellipsoids file loc
var Eye = new vec4.fromValues(0.5,0.5,-0.5,1.0); // default eye position in world space

var ViewUp = new vec3.fromValues(0,1,0); // view up vector
var LookAt = new vec3.fromValues(0,0,1); //look at vector

//light variable
var LightLoc = new vec4.fromValues(-1,3,-0.5,1.0) //default light location in world space
var LightCol = new vec4.fromValues(1.0, 1.0, 1.0, 1.0)// default light color, i.e. white
var EyeLoc = new vec4.fromValues(Eye[0], Eye[1], Eye[2],1.0);

//multiple lights
var lightArray = [];

/* webgl globals */
var gl = null; // the all powerful gl object. It's all here folks!
var vertexBuffer; // this contains vertex coordinates in triples
var triangleBuffer; // this contains indices into vertexBuffer in triples
var triBufferSize = 0; // the number of indices in the triangle buffer
var vertexPositionAttrib; // where to put position for vertex shader

/* matrices required */
var viewMatrix = mat4.create();
var perspMatrix = mat4.create();
var modelMatrix = mat4.create();

//other matrices
var translateMatrix = mat4.create();
var rotateMatrix = mat4.create();

//color position attribute
var diffusePositionAttrib;
var ambientPositionAttrib;
var specularPositionAttrib;
var nPositionAttrib;
var normalPositionAttrib;

//uniform variables
var uniformvMatrix;
var uniformpMatrix;
var uniformmMatrix;
var uniformLightLoc;
var uniformLightCol;
var uniformEyeLoc;

//record pressed keys
var keyPressed = [];
var ellipsoidSelected =-1;
var num_ellipsoid =0;
var triangleSelected =-1;
var num_triangle =0;

var mySelection =-1;
var myEllipsoid =-1;
var triangleSelected =-1;
var ellipsoidSelected =-1;

//control colors
var increase_ambient =0;
var increase_diffuse =0;
var increase_spec=0;

//color weights
var ambi_weight =0;
var diff_weight =0;
var spec_weight =0;
var n_weight=0;

var final_tri_no=0;
var final_ellip_no =0;

//***************
var complete_set = {};
complete_set.selectId = -1;
complete_set.list = [];
//default value is blinn phong, 
//if it is 0 then use phong
var is_blinn_phong =1;
var uniformBlinn;
var aspect =1;

var multiple_light_loc;
var use_light;

// ASSIGNMENT HELPER FUNCTIONS

// get the JSON file from the passed URL
function getJSONFile(url,descr) {
    try {
        if ((typeof(url) !== "string") || (typeof(descr) !== "string"))
            throw "getJSONFile: parameter not a string";
        else {
            var httpReq = new XMLHttpRequest(); // a new http request
            httpReq.open("GET",url,false); // init the request
            httpReq.send(null); // send the request
            var startTime = Date.now();
            while ((httpReq.status !== 200) && (httpReq.readyState !== XMLHttpRequest.DONE)) {
                if ((Date.now()-startTime) > 3000)
                    break;
            } // until its loaded or we time out after three seconds
            if ((httpReq.status !== 200) || (httpReq.readyState !== XMLHttpRequest.DONE))
                throw "Unable to open "+descr+" file!";
            else
                return JSON.parse(httpReq.response); 
        } // end if good params
    } // end try    
    
    catch(e) {
        console.log(e);
        return(String.null);
    }
} // end get json file

//function to initialize view and projection matrices
function initMatrices(){
    //view matrix
    /*Determined by:
    1. The eye, or the position of the viewer;
    2. The center, or the point where we the camera aims;
    3. The up, which defines the direction of the up for the viewer.
    */
    //var viewMatrix = mat4.create();
    var eye = new vec3.fromValues(Eye[0],Eye[1],Eye[2]);

    //define center
    var center = new vec3.fromValues(Eye[0]+LookAt[0], Eye[1]+LookAt[1], Eye[2]+LookAt[2]);
    mat4.lookAt(viewMatrix, eye, center, ViewUp);

    //initialize perspective matrix
    mat4.perspective(perspMatrix, Math.PI/2, aspect, 0.1, 100.0);

    //translate and rotate matrices
    mat4.identity(translateMatrix);
    mat4.identity(rotateMatrix);
}

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    canvas.width = parseInt(document.getElementById("canvas_width").value);
    canvas.height = parseInt(document.getElementById("canvas_height").value);

    //Get window and its dimensions
    var window = {};
    window.left = parseFloat(document.getElementById("window_left").value);
    window.right = parseFloat(document.getElementById("window_right").value);
    window.top = parseFloat(document.getElementById("window_top").value);
    window.bottom = parseFloat(document.getElementById("window_bottom").value);

    //calculate aspect for perspective matrix
    aspect = (window.right - window.left)/(window.top - window.bottom);

    //use multiple light location
    multiple_light_loc = document.getElementById("light_location").value;
    use_light = document.getElementById("use_light").checked;

    gl = canvas.getContext("webgl"); // get a webgl object from it
    gl.viewportWidth = canvas.width;
    gl.viewportHeight = canvas.height;
    
    try {
      if (gl == null) {
        throw "unable to create gl context -- is your browser gl ready?";
      } else {
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0); // use black when we clear the frame buffer
        gl.clearDepth(1.0); // use max when we clear the depth buffer
        gl.enable(gl.DEPTH_TEST); // use hidden surface removal (with zbuffering)
      }
    } // end try
    
    catch(e) {
      console.log(e);
    } // end catch
 
} // end setupWebGL

//choose color, if greater than 0, then round off
function chooseColor(mycolor)
{
    if(mycolor>1.0)
    {
        mycolor=0.0;
    }
    return mycolor;
}

//load multiple lights from json file
function loadLights(){
    var inputLights = getJSONFile(multiple_light_loc, "lights");
    if(inputLights!=String.null){
        console.log("use multiple lights");
    }
}

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set

        final_tri_no = inputTriangles.length;
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {

            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            var centroid = new vec3.fromValues(0,0,0); //calculate triangle centroid
            num_triangle = inputTriangles.length; //
            var centroid = new vec3.fromValues(0,0,0);

            var triangle_gp = {};
            triangle_gp.triBufferSize = 0;
            triangle_gp.specularModel = 1; //store specular coefficient
            triangle_gp.coordArray = []; //store vertices
            triangle_gp.normalArray = []; //store normal
            triangle_gp.indexArray = []; //store index array
            triangle_gp.diffuseArray = []; //store diffuse array
            triangle_gp.ambientArray = []; //store ambient array
            triangle_gp.specularArray = []; //store specular array
            triangle_gp.nArray = []; //store n value

            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                if(whichSet==mySelection && triangleSelected==1)  
                    vec3.add(centroid, centroid, new vec3.fromValues(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]));
                else
                    triangle_gp.coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            }

            var count = inputTriangles[whichSet].vertices.length;
            vec3.scale(centroid, centroid, 1/count);

            //scale vertex if it is choosen
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                if(mySelection==whichSet && triangleSelected==1){
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                    triangle_gp.coordArray.push(((vtxToAdd[0]-centroid[0])*1.2)+centroid[0],
                        ((vtxToAdd[1]-centroid[1])*1.2)+centroid[1],
                        ((vtxToAdd[2]-centroid[2])*1.2)+centroid[2]);
                }
            }
            
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                var triToAdd = inputTriangles[whichSet].triangles[whichSetTri];
                triangle_gp.indexArray.push(triToAdd[0], triToAdd[1], triToAdd[2]);
                triangle_gp.triBufferSize+=3
            } // end for triangles in set

            //setup vertex color
            for(whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                var diff_col= inputTriangles[whichSet].material.diffuse;
                var ambi_col= inputTriangles[whichSet].material.ambient;
                var spec_col= inputTriangles[whichSet].material.specular;

                //add n value
                if(whichSet==mySelection)
                    triangle_gp.nArray.push(inputTriangles[whichSet].material.n+n_weight);
                else
                    triangle_gp.nArray.push(inputTriangles[whichSet].material.n);

                //add ambient color
                if(whichSet==mySelection)
                    triangle_gp.ambientArray.push(chooseColor(ambi_col[0]+ambi_weight), 
                        chooseColor(ambi_col[1]+ambi_weight), chooseColor(ambi_col[2]+ambi_weight), 1.0);
                else
                    triangle_gp.ambientArray.push(ambi_col[0], ambi_col[1], ambi_col[2], 1.0);

                //add diffuse color
                if(whichSet==mySelection)                   
                    triangle_gp.diffuseArray.push(chooseColor(diff_col[0]+diff_weight), 
                        chooseColor(diff_col[1]+diff_weight), 
                        chooseColor(diff_col[2]+diff_weight), 1.0);
                    //triangle_gp.diffuseArray.push(1.0, 0.6, 0.7, 1.0);
                else
                    triangle_gp.diffuseArray.push(diff_col[0], diff_col[1], diff_col[2], 1.0);
                
                //add specular color
                if(whichSet==mySelection)
                    triangle_gp.specularArray.push(chooseColor(spec_col[0]+spec_weight),
                        chooseColor(spec_col[1]+spec_weight), 
                        chooseColor(spec_col[2]+spec_weight), 1.0);
                else
                    triangle_gp.specularArray.push(spec_col[0], spec_col[1], spec_col[2], 1.0);
            }

            // set up the vertex coord array
            //set normal vertices
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].normals.length; whichSetVert++) {
                var normal_val = inputTriangles[whichSet].normals[whichSetVert];
                triangle_gp.normalArray.push(normal_val[0], normal_val[1], normal_val[2], 1.0);
            } // end for vertices in set

            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
        
        // send the vertex coords to webGL
        triangle_gp.vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,triangle_gp.vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(triangle_gp.coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        //send diffuse buffer to webgl
        triangle_gp.diffuseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.diffuseArray), gl.STATIC_DRAW);

        //send ambient buffer to webgl
        triangle_gp.ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.ambientArray), gl.STATIC_DRAW);

        //send specular buffer to webgl
        triangle_gp.specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.specularArray), gl.STATIC_DRAW);

        //send normal buffer to webgl
        triangle_gp.normalValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.normalValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.normalArray), gl.STATIC_DRAW);

        //send n value buffer to webgl
        triangle_gp.nValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.nValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.nArray), gl.STATIC_DRAW);

        // send the triangle indices to webGL
        triangle_gp.triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangle_gp.triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(triangle_gp.indexArray),gl.STATIC_DRAW); // indices to that buffer

        //push triangle group with all details in array
        complete_set.list.push(triangle_gp);
        } // end for each triangle set 
    } // end if triangles found
} // end load triangles

//function to load ellipsoid
function loadEllipsoids() {
    var inputEllipsoid = getJSONFile(INPUT_SPHERES_URL, "ellipsoids");
    if (inputEllipsoid != String.null) {
        var vtxBufferSize = 0;
        var vertexCoord = [];
        var normalArray = [];
        var triangleindexArray = [];
        var offset = 0;

        final_ellip_no = inputEllipsoid.length;

        //define latitude and logitude for drawing ellipsoid
        var latitude_length = 40;
        var longitude_length = 40;

        //color array
        var diffuseArray = [];
        var ambientArray = [];
        var specularArray = [];
        var nArray = [];
        num_ellipsoid = inputEllipsoid.length;  
        
        for (var whichSet = 0; whichSet < inputEllipsoid.length; whichSet++) {
            var triangle_gp = {};
            triangle_gp.triBufferSize = 0;
            triangle_gp.specularModel = 1;
            triangle_gp.coordArray = []; //triangle coordinate array
            triangle_gp.normalArray = []; //triangle normal array
            triangle_gp.indexArray = []; 
            triangle_gp.diffuseArray = []; //triangle diffuse array
            triangle_gp.ambientArray = []; //triangle ambient array
            triangle_gp.specularArray = []; //triangle specular array
            triangle_gp.nArray = []; //triangle n array

            //calculate ellipsoid radius
            var radius1 = inputEllipsoid[whichSet]["a"];
            var radius2 = inputEllipsoid[whichSet]["b"];
            var radius3 = inputEllipsoid[whichSet]["c"];

            //calculate ellipsoid center
            var center_x = inputEllipsoid[whichSet]["x"];
            var center_y = inputEllipsoid[whichSet]["y"];
            var center_z = inputEllipsoid[whichSet]["z"];

            var vertexCoordCount = 0;
            offset = vtxBufferSize; // update vertex offset

            for (var lat = 0; lat <= latitude_length; lat++) {
                var theta = lat * Math.PI / latitude_length;
                var sin_Theta_val = Math.sin(theta);
                var cos_Theta_val = Math.cos(theta);

                for (var long_no = 0; long_no <= longitude_length; long_no++) {
                    var phi = long_no * 2 * Math.PI / longitude_length;
                    var sin_Phi_val = Math.sin(phi);
                    var cos_Phi_val = Math.cos(phi);

                    var x = cos_Phi_val * sin_Theta_val;
                    var y = cos_Theta_val;
                    var z = sin_Phi_val * sin_Theta_val;

                    //push ambient color into array
                    var ambi_col = inputEllipsoid[whichSet].ambient;
                    if(mySelection-final_tri_no == whichSet)
                        triangle_gp.ambientArray.push(chooseColor(ambi_col[0]+ambi_weight), 
                            chooseColor(ambi_col[1]+ambi_weight), 
                            chooseColor(ambi_col[2] + ambi_weight), 1.0);
                    else
                        triangle_gp.ambientArray.push(ambi_col[0], ambi_col[1], ambi_col[2], 1.0);

                    //push diffuse color into array
                    var diff_col = inputEllipsoid[whichSet].diffuse;
                    if(mySelection-final_tri_no == whichSet)
                        triangle_gp.diffuseArray.push(chooseColor(diff_col[0]+diff_weight), 
                            chooseColor(diff_col[1]+diff_weight), 
                            chooseColor(diff_col[2]+diff_weight), 1.0);
                    else
                        triangle_gp.diffuseArray.push(diff_col[0], diff_col[1], diff_col[2], 1.0);

                    //push specular color into array
                    var spec_col = inputEllipsoid[whichSet].specular;
                    if(mySelection - final_tri_no == whichSet)
                        triangle_gp.specularArray.push(chooseColor(spec_col[0]+ spec_weight), 
                            chooseColor(spec_col[1]+ spec_weight), 
                            chooseColor(spec_col[2]+ spec_weight), 1.0);
                    else
                        triangle_gp.specularArray.push(spec_col[0], spec_col[1], spec_col[2], 1.0);

                    //push n value into array 
                    if(mySelection - final_tri_no == whichSet){
                        triangle_gp.nArray.push(inputEllipsoid[whichSet]["n"]+n_weight);
                    }else{
                        triangle_gp.nArray.push(inputEllipsoid[whichSet]["n"]);
                    }

                    //push normal into array
                    triangle_gp.normalArray.push(center_x+x, center_y+y, center_z+z, 1.0);

                    //scale ellipsoid 
                    if(myEllipsoid==whichSet && ellipsoidSelected==1)
                        triangle_gp.coordArray.push(center_x + radius1 * x*1.2,
                            center_y + radius2 * y*1.2,
                            center_z + radius3 * z*1.2);
                    else
                        triangle_gp.coordArray.push(center_x + radius1 * x, 
                        center_y + radius2 * y,
                        center_z + radius3 * z);

                    //increase vertex count
                    vertexCoordCount++;
                }
            }

            //push vertices in triangle 
            var first=0;
            var second=longitude_length+1;
            for(var lat=0; lat<latitude_length; lat++)
            {
                var offset_val =1;
                for(var longt=0; longt<longitude_length; longt++)
                {   
                    triangle_gp.indexArray.push(first + longt, second + longt, first + offset_val);
                    triangle_gp.indexArray.push(second + longt, second + offset_val, first + offset_val);
                    offset_val++;
                    triangle_gp.triBufferSize += 6;
                }
                first=second;
                second += longitude_length + 1;
            }

        //increase vertex size
        vtxBufferSize = vtxBufferSize + vertexCoordCount;        
        
        triangle_gp.normalValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.normalValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.normalArray), gl.STATIC_DRAW);

        triangle_gp.diffuseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.diffuseArray), gl.STATIC_DRAW);

        triangle_gp.ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.ambientArray), gl.STATIC_DRAW);

        triangle_gp.specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.specularArray), gl.STATIC_DRAW);

        triangle_gp.nValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.nValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.nArray), gl.STATIC_DRAW);

        triangle_gp.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, triangle_gp.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_gp.coordArray), gl.STATIC_DRAW);

        triangle_gp.triangleBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangle_gp.triangleBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangle_gp.indexArray), gl.STATIC_DRAW);

        //push all vertices in complete set
        // console.log("complete_set length:"+ complete_set.list.length);
        complete_set.list.push(triangle_gp);
        }
    }
}

// setup the webGL shaders
function setupShaders() {
    
    // define fragment shader in essl using es6 template strings
    var fShaderCode = `
        precision mediump float;

        uniform vec4 finalEyeLoc;
        uniform vec4 finalLightLoc;
        uniform vec4 finalLightCol;

        varying vec4 finalDiffuseColor;
        varying vec4 finalAmbientColor;
        varying vec4 finalSpecularColor;
        varying vec4 finalNormalVal;
        varying float finalNVal;
        varying vec4 finalvertexPosition;

        uniform int selectBlinnPhong;

        void main(void) {

            vec4 l = normalize(finalLightLoc - finalvertexPosition);
            vec4 V = normalize(finalEyeLoc - finalvertexPosition);
            vec4 N = normalize(finalNormalVal);

            float NdotL = max(0.0, dot(N, l));
            vec4 ambientpart = finalLightCol*finalAmbientColor;
            vec4 diffusepart = finalDiffuseColor*finalLightCol*NdotL;

            //blinn phong is selected
            //Ka*La + Kd*Ld*(N•L) + Ks*Ls*(N•H)n = color
            if(selectBlinnPhong==1){
                vec4 H = normalize(finalLightLoc + finalEyeLoc - finalvertexPosition);
                float NdotH = max(0.0, dot(N, H));
                vec4 specularpart = finalSpecularColor*finalLightCol*pow(NdotH, finalNVal);
                vec4 finalColor = ambientpart + diffusepart + specularpart;
                gl_FragColor = finalColor; // all fragments are white
            }

            //Phong is selected
            //Ka*La + Kd*Ld*(N•L) + Ks*Ls*(R•V)n
            else{
                vec4 R = normalize(2.0 * NdotL * (N-l));
                float RdotV = max(0.0, dot(R,V));
                vec4 specularpart = finalSpecularColor*finalLightCol*pow(RdotV, finalNVal);
                vec4 finalColor = ambientpart + diffusepart + specularpart;
                gl_FragColor = finalColor; // all fragments are white
            }
        }
    `;
    
    // define vertex shader in essl using es6 template strings
    var vShaderCode = `
        attribute vec3 vertexPosition;

        attribute vec4 diffuseAttribute;
        attribute vec4 ambientAttribute;
        attribute vec4 specularAttribute;
        attribute float nValAttribute;
        attribute vec4 normalValAttribute;

        uniform mat4 uniformViewMatrix;
        uniform mat4 uniformPerspMatrix;
        uniform mat4 uniformModelMatrix;

        varying vec4 finalDiffuseColor;
        varying vec4 finalAmbientColor;
        varying vec4 finalSpecularColor;
        varying vec4 finalNormalVal;
        varying float finalNVal;
        varying vec4 finalvertexPosition;

        void main(void) {
            finalvertexPosition = uniformPerspMatrix * uniformViewMatrix * uniformModelMatrix * vec4(vertexPosition, 1.0);
            gl_Position = uniformPerspMatrix * uniformViewMatrix * uniformModelMatrix * vec4(vertexPosition, 1.0); // use the untransformed position
            finalDiffuseColor = diffuseAttribute;
            finalAmbientColor = ambientAttribute;
            finalSpecularColor = specularAttribute;
            finalNVal = nValAttribute;
            finalNormalVal = normalValAttribute;
        }
    `;
    
    try {
        // console.log("fragment shader: "+fShaderCode);
        var fShader = gl.createShader(gl.FRAGMENT_SHADER); // create frag shader
        gl.shaderSource(fShader,fShaderCode); // attach code to shader
        gl.compileShader(fShader); // compile the code for gpu execution

        // console.log("vertex shader: "+vShaderCode);
        var vShader = gl.createShader(gl.VERTEX_SHADER); // create vertex shader
        gl.shaderSource(vShader,vShaderCode); // attach code to shader
        gl.compileShader(vShader); // compile the code for gpu execution
            
        if (!gl.getShaderParameter(fShader, gl.COMPILE_STATUS)) { // bad frag shader compile
            throw "error during fragment shader compile: " + gl.getShaderInfoLog(fShader);  
            gl.deleteShader(fShader);
        } else if (!gl.getShaderParameter(vShader, gl.COMPILE_STATUS)) { // bad vertex shader compile
            throw "error during vertex shader compile: " + gl.getShaderInfoLog(vShader);  
            gl.deleteShader(vShader);
        } else { // no compile errors
            var shaderProgram = gl.createProgram(); // create the single shader program
            gl.attachShader(shaderProgram, fShader); // put frag shader in program
            gl.attachShader(shaderProgram, vShader); // put vertex shader in program
            gl.linkProgram(shaderProgram); // link program into gl context

            if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) { // bad program link
                throw "error during shader program linking: " + gl.getProgramInfoLog(shaderProgram);
            } else { // no shader program link errors
                gl.useProgram(shaderProgram); // activate shader program (frag and vert)
                vertexPositionAttrib = // get pointer to vertex shader input
                    gl.getAttribLocation(shaderProgram, "vertexPosition"); 
                gl.enableVertexAttribArray(vertexPositionAttrib); // input to shader from array

                uniformvMatrix = gl.getUniformLocation(shaderProgram, "uniformViewMatrix");
                uniformpMatrix = gl.getUniformLocation(shaderProgram, "uniformPerspMatrix");
                uniformmMatrix = gl.getUniformLocation(shaderProgram, "uniformModelMatrix");

                uniformBlinn = gl.getUniformLocation(shaderProgram, "selectBlinnPhong");

                //get eye location
                uniformEyeLoc = gl.getUniformLocation(shaderProgram, "finalEyeLoc");

                //get light location
                uniformLightLoc = gl.getUniformLocation(shaderProgram, "finalLightLoc");
                uniformLightCol = gl.getUniformLocation(shaderProgram, "finalLightCol");

                //diffuse color position
                diffusePositionAttrib = gl.getAttribLocation(shaderProgram, "diffuseAttribute");
                gl.enableVertexAttribArray(diffusePositionAttrib);

                //ambient color position
                ambientPositionAttrib = gl.getAttribLocation(shaderProgram, "ambientAttribute");
                gl.enableVertexAttribArray(ambientPositionAttrib);

                //specular color position
                specularPositionAttrib = gl.getAttribLocation(shaderProgram, "specularAttribute");
                gl.enableVertexAttribArray(specularPositionAttrib);

                // n value
                nPositionAttrib = gl.getAttribLocation(shaderProgram, "nValAttribute");
                gl.enableVertexAttribArray(nPositionAttrib);

                // normal value
                normalPositionAttrib = gl.getAttribLocation(shaderProgram, "normalValAttribute");
                gl.enableVertexAttribArray(normalPositionAttrib);

            } // end if no shader program link errors
        } // end if no compile errors
    } // end try 
    
    catch(e) {
        console.log(e);
    } // end catch
} // end setup shaders

// render the loaded model
function renderTriangles() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); // clear frame/depth buffers
    
    //set uniform variables: 
    // //view matrix, perspective matrix, light, eye, light_col
    gl.uniformMatrix4fv(uniformvMatrix, false, viewMatrix);
    gl.uniformMatrix4fv(uniformpMatrix, false, perspMatrix);

    //send eye and light coordinates
    gl.uniform4fv(uniformEyeLoc, EyeLoc);
    gl.uniform4fv(uniformLightLoc, LightLoc);
    gl.uniform4fv(uniformLightCol, LightCol);

    console.log("complete_set.list.length:"+ complete_set.list.length);
    console.log("final_tri_no: " + final_tri_no);
    console.log("final_ellip_no: "+ final_ellip_no);

    for(let i = 0; i < complete_set.list.length; i++) {
      //for(let i=complete_set.list.length-1; i>=complete_set.list.length-(final_tri_no + final_ellip_no); i--){
                    // console.log("@@@@@@@@@@@@@@@@@@ mySelection ********: "+ mySelection);

        //set matrices based on selection
        if(mySelection==i){
            var newMatrix = mat4.create();
            mat4.identity(newMatrix);
            mat4.multiply(newMatrix, newMatrix, translateMatrix);
            mat4.multiply(newMatrix, newMatrix, rotateMatrix);
            mat4.multiply(newMatrix, modelMatrix, newMatrix);
            gl.uniformMatrix4fv(uniformmMatrix, false, newMatrix);
            gl.uniform1i(uniformBlinn, is_blinn_phong);
        }
        else{
            gl.uniform1i(uniformBlinn, 1);
            gl.uniformMatrix4fv(uniformmMatrix, false, modelMatrix);
    }
    
    /******************** for rendering triangles *****************/
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,complete_set.list[i].vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // //diffuse color
    gl.bindBuffer(gl.ARRAY_BUFFER, complete_set.list[i].diffuseBuffer);
    gl.vertexAttribPointer(diffusePositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //ambient color
    console.log("complete_set.list[i].ambientBuffer ****" + complete_set.list[i].ambientBuffer[0]);
    gl.bindBuffer(gl.ARRAY_BUFFER, complete_set.list[i].ambientBuffer);
    gl.vertexAttribPointer(ambientPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //specular color
    gl.bindBuffer(gl.ARRAY_BUFFER, complete_set.list[i].specularBuffer);
    gl.vertexAttribPointer(specularPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //n value
    gl.bindBuffer(gl.ARRAY_BUFFER, complete_set.list[i].nValueBuffer);
    gl.vertexAttribPointer(nPositionAttrib, 1, gl.FLOAT, false, 0, 0);
    
    //normal value
    gl.bindBuffer(gl.ARRAY_BUFFER, complete_set.list[i].normalValueBuffer);
    gl.vertexAttribPointer(normalPositionAttrib, 4, gl.FLOAT, false, 0, 0);

   // console.log("************ renderTriangles *************");
    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,complete_set.list[i].triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,complete_set.list[i].triBufferSize,gl.UNSIGNED_SHORT,0); // render

    //console.log("********** drawing triangle ************");
}

    // ************** ellipsoid *************************/
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_vertexposition_buffer);
    // gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

    //     // //diffuse color
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_diffuse_buffer);
    // gl.vertexAttribPointer(diffusePositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //     // ambient color
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_ambient_buffer);
    // gl.vertexAttribPointer(ambientPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //     //specular color
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_specular_buffer);
    // gl.vertexAttribPointer(specularPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    // //sphere // vertex buffer: activate and feed into vertex shader
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_vertexposition_buffer);
    // gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

    // //n value
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_n_value_buffer);
    // gl.vertexAttribPointer(nPositionAttrib, 1, gl.FLOAT, false, 0, 0);
    
    // //normal value
    // gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_normal_buffer);
    // gl.vertexAttribPointer(normalPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    // // sphere // triangle buffer: activate and render
    // gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ellipsoid_triangleindex_buffer);
    // gl.drawElements(gl.TRIANGLES, ellipsoid_triangleindex_buffer.numItems, gl.UNSIGNED_SHORT, 0);

} // end render triangles

//reset color weight
function reset_color_weight()
{
    ambi_weight =0;
    diff_weight =0;
    spec_weight=0;
    n_weight =0;
}

function handleKeyDown()
{
    keyPressed[event.keyCode] = true;
    switch(event.key){
        case "a":
            console.log("translate view left along X axis");
            mat4.translate(modelMatrix, modelMatrix, [0.1, 0, 0]);
            renderTriangles();
            return;
        case "d":
            console.log("translate view right along X axis");
            mat4.translate(modelMatrix, modelMatrix, [-0.1, 0, 0]);
            renderTriangles();
            return;
        case "w":
            console.log("translate view forward along z axis");
            mat4.translate(modelMatrix, modelMatrix, [0, 0, -0.1]);
            renderTriangles();
            return;
        case "s":
            console.log("translate view backward along z axis");
            mat4.translate(modelMatrix, modelMatrix, [0, 0, 0.1]);
            renderTriangles();
            return;
        case "q":
            console.log("translate view up along y axis");
            mat4.translate(modelMatrix, modelMatrix, [0, 0.1, 0]);
            renderTriangles();
            return;
        case "e":
            console.log("translate view down along y axis");
            mat4.translate(modelMatrix, modelMatrix, [0, -0.1, 0]);
            renderTriangles();
            return;
        case "A":
            console.log("rotate view left around Y axis");
            mat4.rotate(modelMatrix, modelMatrix, 0.08, [0, 1, 0]);
            renderTriangles();
            return;
        case "D":
            console.log("rotate view right around Y axis");
            mat4.rotate(modelMatrix, modelMatrix, -0.08, [0, 1, 0]);
            renderTriangles();
            return;
        case "W":
            console.log("rotate view forward around X axis");
            mat4.rotate(modelMatrix, modelMatrix, 0.08, [1, 0, 0]);
            renderTriangles();
            return;
        case "S":
            console.log("rotate view backward around X axis");
            mat4.rotate(modelMatrix, modelMatrix, -0.08, [1, 0, 0]);
            renderTriangles();
            return;

        case "ArrowLeft":
            //select only triangles
            console.log("select/toggle triangle set");
            mySelection = (mySelection + 1)%num_triangle;
            complete_set.list = [];
            triangleSelected=1;
            ellipsoidSelected=-1;
            reset_color_weight();
            loadTriangles();
            loadEllipsoids();
            renderTriangles();
            return;

        case "ArrowRight":
            //select only triangles
            console.log("select/toggle triangle set");
            if(mySelection>0)
                mySelection = mySelection-1;
            else
                mySelection = num_triangle-1;
            complete_set.list = [];
            triangleSelected =1;
            ellipsoidSelected=-1;
            reset_color_weight();
            loadTriangles();
            loadEllipsoids();
            renderTriangles();
            return;

        case "ArrowUp":
            //select only ellipsoid
            console.log("select/toggle ellipsoid set");
            myEllipsoid = ( myEllipsoid + 1)% num_ellipsoid;
            mySelection = myEllipsoid + num_triangle;
            complete_set.list = [];
            triangleSelected =-1;
            ellipsoidSelected=1;
            reset_color_weight();
            loadTriangles();
            loadEllipsoids();
            renderTriangles();
            return;

        case "ArrowDown":
            //select only ellipsoid
            console.log("select/toggle ellipsoid set");
            myEllipsoid = (myEllipsoid + num_ellipsoid - 1)%num_ellipsoid;
            mySelection = myEllipsoid + num_triangle;
            complete_set.list = [];
            triangleSelected =-1;
            ellipsoidSelected=1;
            reset_color_weight();
            loadTriangles();
            loadEllipsoids();
            renderTriangles();
            return;

        case " ":
            console.log("deselect all selections");
            myEllipsoid =-1;
            mySelection =-1;
            ellipsoidSelected=-1;
            triangleSelected =-1;
            complete_set.list = [];
            reset_color_weight();
            loadTriangles();
            loadEllipsoids();
            renderTriangles();
            return;
    }
    //apply action on already selected triangle/ellipsoid
    if(mySelection>=0)
    {
        switch(event.key){

            //PART6: CHANGE LIGHTING ON A MODEL
            case "b":
                console.log("toggle between phong and blinn phong");
                is_blinn_phong = (is_blinn_phong+1)%2;
                renderTriangles();
                return;

            case "n":
                console.log("increase n value");
                increase_n=1;
                increase_ambient =0;
                increase_diffuse=0;
                increase_spec =0;
                if(n_weight<20)
                    n_weight=n_weight+1;
                else
                    n_weight=0;
                loadTriangles();
                loadEllipsoids();
                renderTriangles();
                return;

            case "1":
                console.log("increase ambient color");
                increase_ambient =1;
                increase_diffuse=0;
                increase_spec =0;
                complete_set.list = [];
                if(ambi_weight<1)
                    ambi_weight=ambi_weight+0.1;
                else
                    ambi_weight=0;
                loadTriangles();
                loadEllipsoids();
                renderTriangles();
                return;

            case "2":
                console.log("increase diffuse color");
                increase_diffuse=1;
                increase_ambient =0;
                increase_spec =0;
                complete_set.list = [];
                if(diff_weight<1)
                    diff_weight=diff_weight+0.1;
                else
                    diff_weight=0;
                loadTriangles();
                loadEllipsoids();
                renderTriangles();
                return;

            case "3":
                console.log("increase specular color");
                increase_diffuse=0;
                increase_ambient =0;
                increase_spec =1;
                complete_set.list = [];
                if(spec_weight<1)
                    spec_weight=spec_weight+0.1;
                else
                    spec_weight=0;
                loadTriangles();
                loadEllipsoids();
                renderTriangles();
                return;

            //PART 7: TRANSLATE AND ROTATE*******
            case "k":
                mat4.translate(translateMatrix, translateMatrix, [0.1,0,0]);
                renderTriangles();
                return;
            case ";":
                mat4.translate(translateMatrix, translateMatrix, [-0.1,0,0]);
                renderTriangles();
                return;
            case "o":
                //translate selection forward
                mat4.translate(translateMatrix, translateMatrix, [0, 0, 0.1]);
                renderTriangles();
                return;

            case "l":
                mat4.translate(translateMatrix, translateMatrix, [0,0,-0.1]);
                renderTriangles();
                return;

            case "i":
                //translate selection up
                mat4.translate(translateMatrix, translateMatrix, [0,0.1,0]);
                renderTriangles();
                return;

            case "p":
                //translate selection down
                mat4.translate(translateMatrix, translateMatrix, [0,-0.1,0]);
                renderTriangles();
                return;

            case "K":
                // rotate selection left around view Y (yaw)
                mat4.rotate(rotateMatrix, rotateMatrix, 0.08, [0, 1, 0]);
                renderTriangles();
                return;
            case ":":
                // rotate selection right around view Y (yaw)
                mat4.rotate(rotateMatrix, rotateMatrix, -0.08, [0, 1, 0]);
                renderTriangles();
                return;
            case "O":
                //rotate selection forward around view X
                mat4.rotate(rotateMatrix, rotateMatrix, 0.08, [1, 0, 0]);
                renderTriangles();
                return;
            case "L":
                //rotate selection backward around view X
                mat4.rotate(rotateMatrix, rotateMatrix, -0.08, [1, 0, 0]);
                renderTriangles();
                return;
            case "I":
                // rotate selection clockwise around view Z 
                mat4.rotate(rotateMatrix, rotateMatrix, 0.04, [0, 0, 1]);
                renderTriangles();
                return;
            case "P":
                //rotate selection counterclock around view Z
                mat4.rotate(rotateMatrix, rotateMatrix, -0.04, [0, 0, 1]);
                renderTriangles();
                return;
        }
    }
}

function handleKeyUp()
{
    keyPressed[event.keyCode] = false;
    console.log("********* up key is pressed ******");
}

function handleEvents()
{
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
}

/* MAIN -- HERE is where execution begins after window load */

function main() {
  
  setupWebGL(); // set up the webGL environment
  initMatrices();
  loadTriangles(); // load in the triangles from tri file
  loadEllipsoids();
  setupShaders(); // setup the webGL shaders
  renderTriangles(); // draw the triangles using webGL 
  handleEvents(); 
} // end main
