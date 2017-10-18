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

//color Buffer:
var diffuseBuffer;
var ambientBuffer;
var specularBuffer;
var nValueBuffer;
var normalValueBuffer;

//color position attribute
var diffusePositionAttrib;
var ambientPositionAttrib;
var specularPositionAttrib;
var nPositionAttrib;
var normalPositionAttrib;

//ellipsoid buffer
var ellipsoid_vertexposition_buffer;
var ellipsoid_triangleindex_buffer;
var ellipsoid_diffuse_buffer;
var ellipsoid_ambient_buffer;
var ellipsoid_specular_buffer;
var ellipsoid_normal_buffer;
var ellipsoid_n_value_buffer;

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
    console.log("lookat: " + LookAt[0]);
    //11111 doubt verify center position
    var center = new vec3.fromValues(Eye[0]+LookAt[0], Eye[1]+LookAt[1], Eye[2]+LookAt[2]);
    mat4.lookAt(viewMatrix, eye, center, ViewUp);

    //doubt 11111 perspective matrix
    mat4.perspective(perspMatrix, Math.PI/2, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
}

// set up the webGL environment
function setupWebGL() {

    // Get the canvas and context
    var canvas = document.getElementById("myWebGLCanvas"); // create a js canvas
    canvas.width = document.getElementById("canvas_width").value;
    canvas.height = document.getElementById("canvas_height").value;

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

// read triangles in, load them into webgl buffers
function loadTriangles() {
    var inputTriangles = getJSONFile(INPUT_TRIANGLES_URL,"triangles");

    if (inputTriangles != String.null) { 
        var whichSetVert; // index of vertex in current triangle set
        var whichSetTri; // index of triangle in current triangle set
        var coordArray = []; // 1D array of vertex coords for WebGL
        var indexArray = []; // 1D array of vertex indices for WebGL
        var vtxBufferSize = 0; // the number of vertices in the vertex buffer
        var vtxToAdd = []; // vtx coords to add to the coord array
        var indexOffset = vec3.create(); // the index offset for the current set
        var triToAdd = vec3.create(); // tri indices to add to the index array
        
        var diffuseArray = [];
        var ambientArray = [];
        var specularArray = [];
        var nArray = [];
        var normalArray = [];
        num_triangle = inputTriangles.length;
        for (var whichSet=0; whichSet<inputTriangles.length; whichSet++) {
            vec3.set(indexOffset,vtxBufferSize,vtxBufferSize,vtxBufferSize); // update vertex offset
            var centroid = new vec3.fromValues(0,0,0);
            // set up the vertex coord array
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
                vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                console.log("triangle selected:"+ triangleSelected);
                if(triangleSelected==whichSet)
                {
                    vec3.add(centroid, centroid, new vec3.fromValues(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]));
                }
                else{
                    console.log("***** inside else *********");
                coordArray.push(vtxToAdd[0],vtxToAdd[1],vtxToAdd[2]);
            }
            } // end for vertices in set
            var count = inputTriangles[whichSet].vertices.length;
            vec3.scale(centroid, centroid, 1/count);

            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++) {
            if(triangleSelected==whichSet){
                    vtxToAdd = inputTriangles[whichSet].vertices[whichSetVert];
                    coordArray.push(((vtxToAdd[0]-centroid[0])*1.2)+centroid[0],((vtxToAdd[1]-centroid[1])*1.2)+centroid[1],((vtxToAdd[2]-centroid[2])*1.2)+centroid[2]);
                }
            }
            // set up the triangle index array, adjusting indices across sets
            for (whichSetTri=0; whichSetTri<inputTriangles[whichSet].triangles.length; whichSetTri++) {
                vec3.add(triToAdd,indexOffset,inputTriangles[whichSet].triangles[whichSetTri]);
                indexArray.push(triToAdd[0],triToAdd[1],triToAdd[2]);
            } // end for triangles in set

            //setup vertex color
            for(whichSetVert=0; whichSetVert<inputTriangles[whichSet].vertices.length; whichSetVert++){
                var diff_col= inputTriangles[whichSet].material.diffuse;
                var ambi_col= inputTriangles[whichSet].material.ambient;
                var spec_col= inputTriangles[whichSet].material.specular;

                diffuseArray.push(diff_col[0], diff_col[1], diff_col[2], 1.0);
                ambientArray.push(ambi_col[0], ambi_col[1], ambi_col[2], 1.0);
                specularArray.push(spec_col[0], spec_col[1], spec_col[2], 1.0);
                nArray.push(inputTriangles[whichSet].material.n);
            }

            // set up the vertex coord array
            //doubt 1111 check taking normal value
            for (whichSetVert=0; whichSetVert<inputTriangles[whichSet].normals.length; whichSetVert++) {
                var normal_val = inputTriangles[whichSet].normals[whichSetVert];
                if(triangleSelected==whichSet){
                    normalArray.push(normal_val[0]*1.2, normal_val[1]*1.2, normal_val[2]*1.2, 1.0);
                }
                else{
                    normalArray.push(normal_val[0], normal_val[1], normal_val[2], 1.0);
                }
            } // end for vertices in set


            console.log("***********ambient col:" + ambientArray);
            vtxBufferSize += inputTriangles[whichSet].vertices.length; // total number of vertices
            triBufferSize += inputTriangles[whichSet].triangles.length; // total number of tris
        } // end for each triangle set 
        triBufferSize *= 3; // now total number of indices

        // console.log("coordinates: "+coordArray.toString());
        // console.log("numverts: "+vtxBufferSize);
        // console.log("indices: "+indexArray.toString());
        // console.log("numindices: "+triBufferSize);
        
        // send the vertex coords to webGL
        vertexBuffer = gl.createBuffer(); // init empty vertex coord buffer
        gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate that buffer
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(coordArray),gl.STATIC_DRAW); // coords to that buffer
        
        //send diffuse buffer to webgl
        diffuseBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        //send ambient buffer to webgl
        ambientBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        //send specular buffer to webgl
        specularBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        //send normal buffer to webgl
        normalValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        //send n value buffer to webgl
        nValueBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, nValueBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        // // send the triangle indices to webGL
        triangleBuffer = gl.createBuffer(); // init empty triangle index buffer
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triangleBuffer); // activate that buffer
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indexArray),gl.STATIC_DRAW); // indices to that buffer
       // ellipsoid_triangleindex_buffer.numItems = triangleindexArray.length;
        triangleBuffer.numItems = indexArray.length;
    } // end if triangles found
} // end load triangles

//function to load ellipsoid
function loadEllipsoids() {
    var inputSpheres = getJSONFile(INPUT_SPHERES_URL, "ellipsoids");
    if (inputSpheres != String.null) {
        var vtxBufferSize = 0;
        var vertexCoord = [];
        var normalArray = [];
        var triangleindexArray = [];
        var offset = 0;

        //define latitude and logitude for drawing ellipsoid
        var latitude_length = 40;
        var longitude_length = 40;

        //color array
        var diffuseArray = [];
        var ambientArray = [];
        var specularArray = [];
        var nArray = [];
        num_ellipsoid = inputSpheres.length;   
        
        for (var whichSet = 0; whichSet < inputSpheres.length; whichSet++) {

            var radius1 = inputSpheres[whichSet]["a"];
            var radius2 = inputSpheres[whichSet]["b"];
            var radius3 = inputSpheres[whichSet]["c"];

            var center_x = inputSpheres[whichSet]["x"];
            var center_y = inputSpheres[whichSet]["y"];
            var center_z = inputSpheres[whichSet]["z"];

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
                    var ambi_col = inputSpheres[whichSet].ambient;
                    ambientArray.push(ambi_col[0], ambi_col[1], ambi_col[2], 1.0);
                    
                    //push diffuse color into array
                    var diff_col = inputSpheres[whichSet].diffuse;
                    diffuseArray.push(diff_col[0], diff_col[1], diff_col[2], 1.0);

                    //push specular color into array
                    var spec_col = inputSpheres[whichSet].specular;
                    specularArray.push(spec_col[0], spec_col[1], spec_col[2], 1.0);

                    //push n value into array                    
                    nArray.push(inputSpheres[whichSet]["n"]);

                    //push normal into array
                    normalArray.push(center_x+x, center_y+y, center_z+z, 1.0);

                    //push vertex coordinates into array
                    //scale the vertices
                    if(ellipsoidSelected==whichSet)
                    {
                    vertexCoord.push(center_x + radius1 * x*1.2, 
                        center_y + radius2 * y*1.2,
                        center_z + radius3 * z*1.2);
                    }
                    else
                    {
                        vertexCoord.push(center_x + radius1 * x, 
                        center_y + radius2 * y,
                        center_z + radius3 * z);
                    }
                    //increase vertex count
                    vertexCoordCount++;
                }
            }

            //push triangle vertices 
            for (var lat = 0; lat < latitude_length; lat++) {
                for (var long_no = 0; long_no < longitude_length; long_no++) {
                    var first_tri = (lat * (longitude_length + 1)) + long_no;
                    var second_tri = first_tri + longitude_length + 1;
                    triangleindexArray.push(first_tri + offset, second_tri + offset, first_tri + 1 + offset);
                    triangleindexArray.push(second_tri + offset, second_tri + 1 + offset, first_tri + 1 + offset);
                }
            }
            //increase vertex buffer count
            vtxBufferSize = vtxBufferSize + vertexCoordCount;        
        }

        ellipsoid_normal_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_normal_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normalArray), gl.STATIC_DRAW);

        ellipsoid_diffuse_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_diffuse_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(diffuseArray), gl.STATIC_DRAW);

        ellipsoid_ambient_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_ambient_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ambientArray), gl.STATIC_DRAW);

        ellipsoid_specular_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_specular_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(specularArray), gl.STATIC_DRAW);

        ellipsoid_n_value_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_n_value_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(nArray), gl.STATIC_DRAW);

        ellipsoid_vertexposition_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_vertexposition_buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexCoord), gl.STATIC_DRAW);
        // ellipsoid_vertexposition_buffer.itemSize = 3;
        // ellipsoid_vertexposition_buffer.numItems = vertexCoord.length / 3;

        ellipsoid_triangleindex_buffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ellipsoid_triangleindex_buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(triangleindexArray), gl.STATIC_DRAW);
       // ellipsoid_triangleindex_buffer.itemSize = 1;
        ellipsoid_triangleindex_buffer.numItems = triangleindexArray.length;

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

        void main(void) {

            vec4 l = normalize(finalLightLoc - finalvertexPosition);
            vec4 V = normalize(finalEyeLoc - finalvertexPosition);
            vec4 N = normalize(finalNormalVal);
            vec4 H = normalize(finalLightLoc - finalvertexPosition);

            float NdotL = max(0.0, dot(N, l));
            float NdotH = max(0.0, dot(N, H));
            vec4 ambientpart = finalLightCol*finalAmbientColor;
            vec4 diffusepart = finalDiffuseColor*NdotL;
            vec4 specularpart = finalSpecularColor*pow(NdotH, finalNVal);
            vec4 finalColor = ambientpart + diffusepart + specularpart;

            gl_FragColor = finalColor; // all fragments are white
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
    gl.uniformMatrix4fv(uniformmMatrix, false, modelMatrix);

    //send eye and light coordinates
    gl.uniform4fv(uniformEyeLoc, EyeLoc);
    gl.uniform4fv(uniformLightLoc, LightLoc);
    gl.uniform4fv(uniformLightCol, LightCol);

    /******************** for rendering triangles *****************/
    // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer); // activate
    gl.vertexAttribPointer(vertexPositionAttrib,3,gl.FLOAT,false,0,0); // feed

    // //diffuse color
    gl.bindBuffer(gl.ARRAY_BUFFER, diffuseBuffer);
    gl.vertexAttribPointer(diffusePositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //ambient color
    gl.bindBuffer(gl.ARRAY_BUFFER, ambientBuffer);
    gl.vertexAttribPointer(ambientPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //specular color
    gl.bindBuffer(gl.ARRAY_BUFFER, specularBuffer);
    gl.vertexAttribPointer(specularPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //n value
    gl.bindBuffer(gl.ARRAY_BUFFER, nValueBuffer);
    gl.vertexAttribPointer(nPositionAttrib, 1, gl.FLOAT, false, 0, 0);
    
    //normal value
    gl.bindBuffer(gl.ARRAY_BUFFER, normalValueBuffer);
    gl.vertexAttribPointer(normalPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    console.log("************ renderTriangles *************");
    // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,triangleBuffer); // activate
    gl.drawElements(gl.TRIANGLES,triangleBuffer.numItems,gl.UNSIGNED_SHORT,0); // render

    console.log("********** drawing triangle ************");

    // ************** ellipsoid *************************/
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_vertexposition_buffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

        // //diffuse color
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_diffuse_buffer);
    gl.vertexAttribPointer(diffusePositionAttrib, 4, gl.FLOAT, false, 0, 0);

        // ambient color
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_ambient_buffer);
    gl.vertexAttribPointer(ambientPositionAttrib, 4, gl.FLOAT, false, 0, 0);

        //specular color
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_specular_buffer);
    gl.vertexAttribPointer(specularPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    //sphere // vertex buffer: activate and feed into vertex shader
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_vertexposition_buffer);
    gl.vertexAttribPointer(vertexPositionAttrib, 3, gl.FLOAT, false, 0, 0);

    //n value
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_n_value_buffer);
    gl.vertexAttribPointer(nPositionAttrib, 1, gl.FLOAT, false, 0, 0);
    
    //normal value
    gl.bindBuffer(gl.ARRAY_BUFFER, ellipsoid_normal_buffer);
    gl.vertexAttribPointer(normalPositionAttrib, 4, gl.FLOAT, false, 0, 0);

    // sphere // triangle buffer: activate and render
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ellipsoid_triangleindex_buffer);
    gl.drawElements(gl.TRIANGLES, ellipsoid_triangleindex_buffer.numItems, gl.UNSIGNED_SHORT, 0);

} // end render triangles

//function to initialize view and projection matrices
function initMatrices(){
    //view matrix
    /*Determined by:
    1. The eye, or the position of the viewer;
    2. The center, or the point where we the camera aims;
    3. The up, which defines the direction of the up for the viewer.
    */
    
    //model matrix
    mat4.identity(modelMatrix);

    //var viewMatrix = mat4.create();
    var eye = new vec3.fromValues(Eye[0],Eye[1],Eye[2]);
    console.log("lookat: " + LookAt[0]);
    //11111 doubt verify center position
    var center = new vec3.fromValues(Eye[0]+LookAt[0], Eye[1]+LookAt[1], Eye[2]+LookAt[2]);
    mat4.lookAt(viewMatrix, eye, center, ViewUp);

    //doubt 11111 perspective matrix
    mat4.perspective(perspMatrix, Math.PI/2, gl.viewportWidth / gl.viewportHeight, 0.1, 100.0);
}

function handleKeyDown()
{
    keyPressed[event.keyCode] = true;
    console.log("Down key is preseed");
    console.log("**** key: ****" + event.key);

    //Doubt 1111 verify rotation direction
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
            console.log("left arrow is selected");
            triangleSelected = (triangleSelected + 1)%num_triangle;
            loadTriangles();
            renderTriangles();
            return;

        case "ArrowRight":
            console.log("right arrow is selected, triangleSelected"+ triangleSelected);
            console.log("num_triangle: "+ num_triangle);
            if(triangleSelected>0)
            {
                triangleSelected = triangleSelected-1;
            }
            else
            {
                triangleSelected = num_triangle-1;
            }
            loadTriangles();
            renderTriangles();
            return;

        case "ArrowUp":
            console.log("Up arrow is selected");
            ellipsoidSelected = (ellipsoidSelected + 1)%num_ellipsoid;
            loadEllipsoids();
            renderTriangles();
            return;

        case "ArrowDown":
            console.log("Down arrow is selected");
            ellipsoidSelected = (ellipsoidSelected + num_ellipsoid - 1)%num_ellipsoid;
            loadEllipsoids();
            renderTriangles();
            return;

        case " ":
            ellipsoidSelected =-1;
            triangleSelected = -1;
            loadTriangles();
            loadEllipsoids();
            renderTriangles();

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
  renderTriangles();
  handleEvents();
  
} // end main
